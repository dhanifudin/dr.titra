<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { localTasks, timerState, projects, settings, activeProjectTab, persistLocalTasks, persistTimerState, setError } from './store.js';
  import { api } from './api.js';
  import { fmtShort, taskTodayMs, taskTotalMs, todayDate, liveSessionMs } from './time.js';

  let newText = '';
  let showDone = false;
  let now = Date.now();
  let ticker = null;

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => { now = Date.now(); }, 500);
  }
  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }
  $: {
    if ($timerState.status === 'running') startTicker();
    else stopTicker();
  }
  onMount(() => { if ($timerState.status === 'running') startTicker(); });
  onDestroy(stopTicker);

  // Select the first project tab once projects load; stay undefined until then
  $: if ($activeProjectTab === undefined && $projects.length > 0) {
    activeProjectTab.set($projects[0]._id);
  }

  $: tabs = (() => {
    const list = $projects.map(p => ({ id: p._id, name: p.name }));
    // Always offer an "Unassigned" tab so tasks without a project can still be added/viewed
    list.push({ id: null, name: 'Unassigned' });
    return list;
  })();

  $: filteredPending = $localTasks.filter(t => !t.done && (t.projectId || null) === ($activeProjectTab ?? null));
  $: filteredDone = $localTasks.filter(t => t.done && (t.projectId || null) === ($activeProjectTab ?? null));

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function addTask() {
    const text = newText.trim();
    if (!text) return;
    const tabId = $activeProjectTab ?? null;
    const proj = $projects.find(p => p._id === tabId);
    const task = {
      id: uid(),
      text,
      projectId: tabId,
      projectName: proj?.name || '',
      done: false,
      totalMs: 0,
      sessions: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await persistLocalTasks([...$localTasks, task]);
    newText = '';
  }

  async function commitActiveSession({ sendEntry = false } = {}) {
    const ts = $timerState;
    if (ts.status === 'stopped' || !ts.activeTaskId) return 0;

    const sessionMs = liveSessionMs(ts);
    const { apiToken, baseUrl } = get(settings);

    if (ts.status === 'running' && apiToken) {
      try { await api.stopTimer(apiToken, baseUrl); } catch {}
    }

    if (sessionMs > 0) {
      const date = todayDate();
      const entry = { date, ms: sessionMs, endedAt: new Date().toISOString() };
      const updated = $localTasks.map(t =>
        t.id === ts.activeTaskId
          ? { ...t, totalMs: (t.totalMs || 0) + sessionMs, sessions: [...(t.sessions || []), entry] }
          : t
      );
      await persistLocalTasks(updated);

      if (sendEntry && sessionMs >= 60000) {
        const task = updated.find(t => t.id === ts.activeTaskId);
        if (task?.projectId && apiToken) {
          const hours = parseFloat((sessionMs / 3600000).toFixed(2));
          try {
            await api.createTimeEntry(apiToken, baseUrl, {
              projectId: task.projectId,
              task: task.text || 'Time entry from dr.titra',
              date,
              hours: Math.max(hours, 0.01),
            });
          } catch (e) {
            setError(`Titra entry failed: ${e?.message || String(e)}`);
          }
        }
      }
    }

    return sessionMs;
  }

  async function startTask(taskId) {
    const { apiToken, baseUrl } = get(settings);
    if (!apiToken) { setError('Add your API token in Settings first.'); return; }

    const ts = $timerState;

    if (ts.activeTaskId && ts.activeTaskId !== taskId && ts.status !== 'stopped') {
      await commitActiveSession({ sendEntry: true });
    }

    try {
      const res = await api.startTimer(apiToken, baseUrl);
      const startTime = res?.payload?.startTime || new Date().toISOString();
      await persistTimerState({
        status: 'running',
        startTime,
        accumulatedMs: ts.activeTaskId === taskId ? (ts.accumulatedMs || 0) : 0,
        activeTaskId: taskId,
      });
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  async function pauseActive() {
    const { apiToken, baseUrl } = get(settings);
    const ts = $timerState;
    if (ts.status !== 'running') return;
    try {
      const live = ts.startTime ? Date.now() - new Date(ts.startTime).getTime() : 0;
      let duration = live;
      try {
        const res = await api.stopTimer(apiToken, baseUrl);
        duration = res?.payload?.duration ?? live;
      } catch {}
      await persistTimerState({
        ...ts,
        status: 'paused',
        startTime: null,
        accumulatedMs: (ts.accumulatedMs || 0) + duration,
      });
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  async function toggleTask(taskId) {
    const ts = $timerState;
    if (ts.activeTaskId === taskId && ts.status === 'running') {
      await pauseActive();
    } else {
      await startTask(taskId);
    }
  }

  async function markDone(taskId) {
    if ($timerState.activeTaskId === taskId && $timerState.status !== 'stopped') {
      await commitActiveSession({ sendEntry: true });
    }
    const updated = $localTasks.map(t =>
      t.id === taskId
        ? { ...t, done: true, completedAt: new Date().toISOString() }
        : t
    );
    await persistLocalTasks(updated);

    if ($timerState.activeTaskId === taskId) {
      await persistTimerState({
        status: 'stopped',
        startTime: null,
        accumulatedMs: 0,
        activeTaskId: null,
      });
    }
  }

  async function reopen(taskId) {
    const updated = $localTasks.map(t =>
      t.id === taskId ? { ...t, done: false, completedAt: null } : t
    );
    await persistLocalTasks(updated);
  }

  function handleAddKeydown(e) {
    if (e.key === 'Enter') addTask();
  }

  function isActiveRunning(task) {
    return task.id === $timerState.activeTaskId && $timerState.status === 'running';
  }

  function isActivePaused(task) {
    return task.id === $timerState.activeTaskId && $timerState.status === 'paused';
  }

  function selectTab(id) {
    activeProjectTab.set(id);
  }
</script>

<div class="tasks">
  {#if tabs.length > 0}
    <div class="tabs" role="tablist">
      {#each tabs as tab (tab.id ?? '__none')}
        <button
          class="tab"
          class:active={($activeProjectTab ?? null) === tab.id}
          class:unassigned={tab.id === null}
          on:click={() => selectTab(tab.id)}
          title={tab.name}
          role="tab"
        >{tab.name}</button>
      {/each}
    </div>
  {/if}

  <div class="add-row">
    <input
      type="text"
      bind:value={newText}
      placeholder="Add a task…"
      on:keydown={handleAddKeydown}
    />
    <button class="add-btn" on:click={addTask} disabled={!newText.trim()} title="Add">＋</button>
  </div>

  <ul class="list">
    {#each filteredPending as task (task.id)}
      <li
        class="task"
        class:active={task.id === $timerState.activeTaskId}
        class:running={isActiveRunning(task)}
        on:dblclick={() => toggleTask(task.id)}
      >
        <button
          class="check"
          on:click|stopPropagation={() => markDone(task.id)}
          title="Mark as done"
          aria-label="Mark as done"
        ></button>
        <div class="body">
          <span class="text">{task.text}</span>
          <div class="meta">
            <span class="time-today" title="Today">▸ {(now, fmtShort(taskTodayMs(task, $timerState)))}</span>
            <span class="time-total" title="Total">Σ {(now, fmtShort(taskTotalMs(task, $timerState)))}</span>
          </div>
        </div>
        {#if isActiveRunning(task)}
          <button
            class="play pause-btn"
            on:click|stopPropagation={pauseActive}
            title="Pause"
            aria-label="Pause"
          >⏸</button>
        {:else}
          <button
            class="play start-btn"
            class:resume={isActivePaused(task)}
            on:click|stopPropagation={() => startTask(task.id)}
            title={isActivePaused(task) ? 'Resume' : 'Start'}
            aria-label={isActivePaused(task) ? 'Resume' : 'Start'}
          >▶</button>
        {/if}
      </li>
    {/each}

    {#if filteredPending.length === 0}
      <li class="empty">No tasks in this project. Add one above.</li>
    {/if}
  </ul>

  {#if filteredDone.length > 0}
    <button class="done-toggle" on:click={() => showDone = !showDone}>
      {showDone ? '▾' : '▸'} Done ({filteredDone.length})
    </button>

    {#if showDone}
      <ul class="list done-list">
        {#each filteredDone as task (task.id)}
          <li class="task done">
            <button
              class="check checked"
              on:click={() => reopen(task.id)}
              title="Reopen task"
              aria-label="Reopen task"
            >✓</button>
            <div class="body">
              <span class="text">{task.text}</span>
              <div class="meta">
                <span class="time-total">Σ {fmtShort(task.totalMs || 0)}</span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .tasks {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px 14px;
    gap: 10px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
    scrollbar-width: thin;
  }

  .tabs::-webkit-scrollbar { height: 3px; }

  .tab {
    background: transparent;
    color: var(--text-dim);
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    white-space: nowrap;
    flex-shrink: 0;
    border-bottom: 2px solid transparent;
  }

  .tab:hover:not(:disabled) {
    background: var(--surface);
    color: var(--text);
    opacity: 1;
  }

  .tab.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border-bottom-color: var(--accent);
  }

  .tab.unassigned {
    font-style: italic;
  }

  .add-row {
    display: flex;
    gap: 6px;
  }

  .add-row input { flex: 1; }

  .add-btn {
    background: var(--accent);
    color: var(--bg);
    font-weight: 700;
    padding: 6px 12px;
    font-size: 16px;
    line-height: 1;
    min-width: 36px;
  }

  .list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 10px;
    background: var(--surface);
    border: 1px solid transparent;
    border-radius: 8px;
    transition: background 0.15s, border-color 0.15s;
    user-select: none;
  }

  .task:hover { background: var(--surface2); }

  .task.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }

  .task.running {
    border-color: var(--green);
    background: color-mix(in srgb, var(--green) 10%, var(--surface));
  }

  .check {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border-radius: 50%;
    border: 2px solid var(--text-dim);
    background: transparent;
    padding: 0;
    transition: border-color 0.15s, background 0.15s;
  }

  .check:hover {
    border-color: var(--green);
    background: color-mix(in srgb, var(--green) 15%, transparent);
  }

  .check.checked {
    background: var(--green);
    border-color: var(--green);
    color: var(--bg);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .text {
    color: var(--text);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task.done .text {
    color: var(--text-dim);
    text-decoration: line-through;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    flex-wrap: wrap;
  }

  .time-today, .time-total {
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .time-today {
    color: var(--accent);
    font-weight: 600;
  }

  .play {
    width: 28px;
    height: 28px;
    min-width: 28px;
    padding: 0;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play.start-btn {
    background: var(--green);
    color: var(--bg);
  }

  .play.start-btn.resume {
    background: var(--yellow);
    color: var(--bg);
  }

  .play.pause-btn {
    background: var(--yellow);
    color: var(--bg);
    animation: pulseBtn 1.4s ease-in-out infinite;
  }

  @keyframes pulseBtn {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--yellow) 60%, transparent); }
    50% { box-shadow: 0 0 0 6px transparent; }
  }

  .empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 11px;
    padding: 14px 4px;
    font-style: italic;
  }

  .done-toggle {
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 6px;
    text-align: left;
    border-radius: 4px;
  }

  .done-toggle:hover:not(:disabled) {
    background: var(--surface);
    opacity: 1;
  }

  .done-list .task {
    background: transparent;
    border-color: transparent;
  }

  .done-list .task:hover {
    background: var(--surface);
  }
</style>
