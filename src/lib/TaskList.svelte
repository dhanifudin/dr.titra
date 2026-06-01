<script>
  import { onMount, onDestroy } from 'svelte';
  import { localTasks, timerState, projects, activeProjectTab, persistLocalTasks, persistTimerState } from './store.js';
  import { commitActiveSession, pauseTimer, startTask } from './timer-controller.js';
  import { fmtShort, taskTodayMs, taskTotalMs } from './time.js';

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

  $: tabs = (() => {
    const list = [];
    const seen = new Set();

    for (const project of $projects) {
      if (seen.has(project._id)) continue;
      seen.add(project._id);
      list.push({ id: project._id, name: project.name });
    }

    for (const task of $localTasks) {
      const projectId = task.projectId || null;
      if (projectId === null || seen.has(projectId)) continue;
      seen.add(projectId);
      list.push({ id: projectId, name: task.projectName || 'Local project' });
    }

    // Always offer an "Unassigned" tab so tasks without a project can still be added/viewed
    list.push({ id: null, name: 'Unassigned' });
    return list;
  })();

  // Select the first real project tab once task/project data loads; defers if only Unassigned exists.
  $: if ($activeProjectTab === undefined) {
    const firstProject = tabs.find(t => t.id !== null);
    if (firstProject) activeProjectTab.set(firstProject.id);
  }

  $: filteredPending = $localTasks.filter(t => !t.done && (t.projectId || null) === ($activeProjectTab ?? null));
  $: filteredDone = $localTasks.filter(t => t.done && (t.projectId || null) === ($activeProjectTab ?? null));
  $: activeTask = $localTasks.find(t => t.id === $timerState.activeTaskId) || null;

  $: if ($timerState.status !== 'stopped' && activeTask) {
    const activeTabId = activeTask.projectId || null;
    if (($activeProjectTab ?? null) !== activeTabId) {
      activeProjectTab.set(activeTabId);
    }
  }

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

  async function toggleTask(taskId) {
    const ts = $timerState;
    if (ts.activeTaskId === taskId && ts.status === 'running') {
      await pauseTimer();
    } else {
      await startTask(taskId);
    }
  }

  async function markDone(taskId) {
    const activeSnapshot = $timerState.activeTaskId === taskId ? $timerState : null;
    if (activeSnapshot && activeSnapshot.status !== 'stopped') {
      await commitActiveSession(activeSnapshot, { sendEntry: true });
      await persistTimerState({
        status: 'stopped',
        startTime: null,
        accumulatedMs: 0,
        activeTaskId: null,
      });
    }

    const updated = $localTasks.map(t =>
      t.id === taskId
        ? { ...t, done: true, completedAt: new Date().toISOString() }
        : t
    );
    await persistLocalTasks(updated);
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
        class:running={task.id === $timerState.activeTaskId && $timerState.status === 'running' && !!$timerState.startTime}
        class:paused={task.id === $timerState.activeTaskId && $timerState.status === 'paused'}
        on:dblclick={() => toggleTask(task.id)}
      >
        <button
          class="check"
          on:click|stopPropagation={() => markDone(task.id)}
          on:dblclick|stopPropagation
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
        {#if task.id === $timerState.activeTaskId && $timerState.status === 'running'}
          <button
            class="play pause-btn"
            on:click|stopPropagation={pauseTimer}
            on:dblclick|stopPropagation
            title="Pause"
            aria-label="Pause"
          >⏸</button>
        {:else}
          <button
            class="play start-btn"
            class:resume={task.id === $timerState.activeTaskId && $timerState.status === 'paused'}
            on:click|stopPropagation={() => startTask(task.id)}
            on:dblclick|stopPropagation
            title={task.id === $timerState.activeTaskId && $timerState.status === 'paused' ? 'Resume' : 'Start'}
            aria-label={task.id === $timerState.activeTaskId && $timerState.status === 'paused' ? 'Resume' : 'Start'}
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
              on:dblclick|stopPropagation
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

  .task.paused {
    border-color: var(--yellow);
    background: color-mix(in srgb, var(--yellow) 12%, var(--surface));
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
