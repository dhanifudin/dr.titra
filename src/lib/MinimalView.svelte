<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import { localTasks, timerState, settings, persistTimerState, minimal, view, setError } from './store.js';
  import { api } from './api.js';
  import { fmtClock, liveSessionMs } from './time.js';

  let now = Date.now();
  let ticker = null;

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => { now = Date.now(); }, 250);
  }
  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  $: {
    if ($timerState.status === 'running') startTicker();
    else { stopTicker(); now = Date.now(); }
  }

  $: sessionMs = (now, liveSessionMs($timerState));
  $: activeTask = $localTasks.find(t => t.id === $timerState.activeTaskId) || null;
  $: isRunning = $timerState.status === 'running';

  onMount(() => {
    if (isRunning) startTicker();
  });
  onDestroy(stopTicker);

  async function exitMinimal() {
    try {
      await getCurrentWindow().setSize(new LogicalSize(360, 540));
      minimal.set(false);
      view.set('widget');
    } catch (e) {
      console.error('Failed to exit minimal mode', e);
    }
  }

  async function hideToTray() {
    await getCurrentWindow().hide();
  }

  async function startActive() {
    const { apiToken, baseUrl } = get(settings);
    if (!apiToken) { setError('Add API token first.'); return; }
    if (!$timerState.activeTaskId) { setError('Pick a task in the full view.'); return; }
    try {
      const res = await api.startTimer(apiToken, baseUrl);
      const startTime = res?.payload?.startTime || new Date().toISOString();
      await persistTimerState({
        ...$timerState,
        status: 'running',
        startTime,
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

  function togglePlay() {
    if (isRunning) pauseActive();
    else startActive();
  }

  $: statusClass = $timerState.status;
</script>

<div class="mini" class:running={isRunning} data-tauri-drag-region>
  <span class="dot {statusClass}" data-tauri-drag-region></span>
  <span class="time {statusClass}" data-tauri-drag-region>{fmtClock(sessionMs)}</span>
  <span class="task-text" data-tauri-drag-region>
    {#if activeTask}{activeTask.text}{:else}No task{/if}
  </span>
  <div class="ctrls">
    {#if activeTask}
      <button
        class="btn play"
        class:pause={isRunning}
        on:click={togglePlay}
        title={isRunning ? 'Pause' : 'Start'}
        aria-label={isRunning ? 'Pause' : 'Start'}
      >{isRunning ? '⏸' : '▶'}</button>
    {/if}
    <button class="btn small" on:click={exitMinimal} title="Expand">⤢</button>
    <button class="btn small close" on:click={hideToTray} title="Hide">×</button>
  </div>
</div>

<style>
  .mini {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100vh;
    padding: 0 8px 0 12px;
    background: var(--bg);
    color: var(--text);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    user-select: none;
    overflow: hidden;
  }

  .mini.running {
    border-color: var(--green);
  }

  .dot {
    width: 7px;
    height: 7px;
    min-width: 7px;
    border-radius: 50%;
    background: var(--text-dim);
  }
  .dot.running {
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
    animation: pulseDot 1.4s ease-in-out infinite;
  }
  .dot.paused { background: var(--yellow); }
  .dot.stopped { background: var(--text-dim); }

  @keyframes pulseDot {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .time {
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 1px;
    color: var(--text);
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    min-width: 75px;
  }
  .time.running { color: var(--green); }
  .time.paused { color: var(--yellow); }

  .task-text {
    flex: 1;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctrls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn {
    background: var(--surface2);
    color: var(--text);
    border: none;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:hover { opacity: 0.85; }

  .btn.play {
    background: var(--green);
    color: var(--bg);
  }
  .btn.play.pause {
    background: var(--yellow);
    color: var(--bg);
  }

  .btn.small {
    background: transparent;
    color: var(--text-dim);
    font-size: 14px;
  }
  .btn.small:hover {
    background: var(--surface);
    color: var(--text);
    opacity: 1;
  }
  .btn.small.close:hover {
    background: var(--red);
    color: var(--bg);
  }
</style>
