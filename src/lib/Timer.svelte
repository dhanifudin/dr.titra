<script>
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { settings, timerState, localTasks, projects, setError, errorMsg } from './store.js';
  import { api } from './api.js';
  import { fmtClock, fmtShort, totalTodayMs, liveSessionMs } from './time.js';

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

  // Force recomputation of derived values on each tick by depending on `now`
  $: sessionMs = (now, liveSessionMs($timerState));
  $: dailyMs = (now, totalTodayMs($localTasks, $timerState));
  $: activeTask = $localTasks.find(t => t.id === $timerState.activeTaskId) || null;

  async function loadProjects(token, baseUrl) {
    try {
      const res = await api.listProjects(token, baseUrl);
      projects.set(res.payload || []);
    } catch (e) {
      setError(`Could not load projects: ${e?.message || String(e)}`);
    }
  }

  $: if ($settings.apiToken) loadProjects($settings.apiToken, $settings.baseUrl);

  onDestroy(stopTicker);

  $: statusLabel = {
    running: 'Running',
    paused: 'Paused',
    stopped: 'Idle',
  }[$timerState.status] ?? '';

  $: statusClass = $timerState.status;
</script>

<div class="timer-section">
  <div class="display">
    <span class="time">{fmtClock(sessionMs)}</span>
    <span class="badge {statusClass}">{statusLabel}</span>
  </div>

  <div class="active-task">
    {#if activeTask}
      <span class="active-label">Working on:</span>
      <span class="active-text">{activeTask.text}</span>
      {#if activeTask.projectName}
        <span class="project-chip">{activeTask.projectName}</span>
      {/if}
    {:else}
      <span class="hint">Tap ▶ on a task below to start timing.</span>
    {/if}
  </div>

  <div class="daily">
    <span class="daily-label">Today</span>
    <span class="daily-time">{fmtShort(dailyMs)}</span>
  </div>

  {#if $errorMsg}
    <p class="error-msg">{$errorMsg}</p>
  {/if}

  {#if activeTask && $timerState.status !== 'stopped' && !activeTask.projectId}
    <p class="hint warn">No project on this task — time saves locally only.</p>
  {/if}
</div>

<style>
  .timer-section {
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .display {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .time {
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 1.5px;
    color: var(--text);
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    line-height: 1;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px 4px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    line-height: 1;
    border: 1px solid transparent;
  }

  .badge::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 0 currentColor;
  }

  .badge.running {
    background: color-mix(in srgb, var(--green) 18%, transparent);
    color: var(--green);
    border-color: color-mix(in srgb, var(--green) 30%, transparent);
  }
  .badge.running::before {
    animation: badgePulse 1.4s ease-in-out infinite;
  }

  .badge.paused {
    background: color-mix(in srgb, var(--yellow) 18%, transparent);
    color: var(--yellow);
    border-color: color-mix(in srgb, var(--yellow) 30%, transparent);
  }

  .badge.stopped {
    background: color-mix(in srgb, var(--text-dim) 16%, transparent);
    color: var(--text-dim);
    border-color: color-mix(in srgb, var(--text-dim) 25%, transparent);
  }

  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 70%, transparent); }
    50% { box-shadow: 0 0 0 5px transparent; }
  }

  .active-task {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
    min-height: 22px;
    font-size: 12px;
  }

  .active-label { color: var(--text-dim); }

  .active-text {
    color: var(--text);
    font-weight: 600;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-chip {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
    padding: 1px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 600;
  }

  .daily {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
  }

  .daily-label {
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
    font-weight: 700;
  }

  .daily-time {
    color: var(--accent);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .error-msg {
    font-size: 11px;
    color: var(--red);
    text-align: center;
    margin-top: 8px;
    padding: 6px;
    background: color-mix(in srgb, var(--red) 10%, transparent);
    border-radius: 6px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
  }

  .hint.warn {
    color: var(--yellow);
    margin-top: 8px;
  }
</style>
