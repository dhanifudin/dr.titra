<script>
  import { onMount, onDestroy } from 'svelte';
  import { localTasks, timerState } from './store.js';
  import { fmtShort, todayDate, weekRange, monthRange, taskMsInRange, totalMsInRange } from './time.js';

  let range = 'day'; // 'day' | 'week' | 'month'
  let now = Date.now();
  let ticker = null;

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => { now = Date.now(); }, 1000);
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

  $: rangeDates = (() => {
    if (range === 'day') {
      const d = todayDate();
      return [d, d];
    }
    if (range === 'week') return weekRange();
    return monthRange();
  })();

  $: rangeLabel = (() => {
    if (range === 'day') return 'Today';
    if (range === 'week') return 'This week';
    return 'This month';
  })();

  $: total = (now, totalMsInRange($localTasks, $timerState, rangeDates[0], rangeDates[1]));

  $: taskBreakdown = (() => {
    void now;
    const [from, to] = rangeDates;
    const liveMs = $timerState.activeTaskId ? liveMsForActive() : 0;
    const rows = $localTasks.map(t => {
      let ms = taskMsInRange(t, from, to);
      if (t.id === $timerState.activeTaskId && $timerState.status !== 'stopped' && todayDate() >= from && todayDate() <= to) {
        ms += liveMs;
      }
      return { id: t.id, text: t.text, projectName: t.projectName, done: t.done, ms };
    }).filter(r => r.ms > 0);
    rows.sort((a, b) => b.ms - a.ms);
    return rows;
  })();

  function liveMsForActive() {
    const ts = $timerState;
    let ms = ts.accumulatedMs || 0;
    if (ts.status === 'running' && ts.startTime) {
      ms += Date.now() - new Date(ts.startTime).getTime();
    }
    return ms;
  }

  $: projectBreakdown = (() => {
    const grouped = new Map();
    for (const row of taskBreakdown) {
      const key = row.projectName || '(no project)';
      grouped.set(key, (grouped.get(key) || 0) + row.ms);
    }
    return Array.from(grouped.entries())
      .map(([name, ms]) => ({ name, ms }))
      .sort((a, b) => b.ms - a.ms);
  })();
</script>

<div class="dashboard">
  <h2>Dashboard</h2>

  <div class="tabs">
    <button class:active={range === 'day'} on:click={() => range = 'day'}>Daily</button>
    <button class:active={range === 'week'} on:click={() => range = 'week'}>Weekly</button>
    <button class:active={range === 'month'} on:click={() => range = 'month'}>Monthly</button>
  </div>

  <div class="total-card">
    <span class="total-label">{rangeLabel}</span>
    <span class="total-time">{fmtShort(total)}</span>
    <span class="total-range">{rangeDates[0]} → {rangeDates[1]}</span>
  </div>

  <div class="section">
    <h3>By task</h3>
    {#if taskBreakdown.length === 0}
      <p class="empty">No time tracked in this range.</p>
    {:else}
      <ul class="bars">
        {#each taskBreakdown as row (row.id)}
          <li class="bar-row">
            <div class="bar-header">
              <span class="bar-text" class:done={row.done}>{row.text}</span>
              <span class="bar-time">{fmtShort(row.ms)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: {(row.ms / total * 100).toFixed(1)}%"></div>
            </div>
            {#if row.projectName}
              <span class="bar-proj">{row.projectName}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if projectBreakdown.length > 0}
    <div class="section">
      <h3>By project</h3>
      <ul class="bars">
        {#each projectBreakdown as row (row.name)}
          <li class="bar-row">
            <div class="bar-header">
              <span class="bar-text">{row.name}</span>
              <span class="bar-time">{fmtShort(row.ms)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill alt" style="width: {(row.ms / total * 100).toFixed(1)}%"></div>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    padding: 14px 16px;
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h2 {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
  }

  h3 {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: var(--surface);
    padding: 3px;
    border-radius: 8px;
  }

  .tabs button {
    flex: 1;
    background: transparent;
    color: var(--text-dim);
    padding: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .tabs button.active {
    background: var(--accent);
    color: var(--bg);
  }

  .total-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: var(--surface);
    padding: 14px;
    border-radius: 10px;
  }

  .total-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .total-time {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .total-range {
    font-size: 10px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }

  .section { margin-top: 2px; }

  .bars {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bar-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .bar-text {
    font-size: 12px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-text.done {
    text-decoration: line-through;
    color: var(--text-dim);
  }

  .bar-time {
    font-size: 11px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .bar-track {
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s;
  }

  .bar-fill.alt {
    background: var(--green);
  }

  .bar-proj {
    font-size: 10px;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 600;
    align-self: flex-start;
    margin-top: 1px;
  }

  .empty {
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
    font-style: italic;
    padding: 14px 0;
  }
</style>
