<script>
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import { localTasks, timerState, minimal, view, setError } from './store.js';
  import { pauseTimer, startTask } from './timer-controller.js';
  import { fmtClock, fmtShort, liveSessionMs, totalTodayMs } from './time.js';

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
  $: todayMs = (now, totalTodayMs($localTasks, $timerState));

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
    if (!$timerState.activeTaskId) { setError('Pick a task in the full view.'); return; }
    await startTask($timerState.activeTaskId);
  }

  async function pauseActive() {
    await pauseTimer();
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
  <span class="today-total" data-tauri-drag-region>Today {fmtShort(todayMs)}</span>
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

  .today-total {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
