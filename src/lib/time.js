export function fmtClock(ms) {
  const s = Math.floor(Math.max(ms, 0) / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

export function fmtShort(ms) {
  if (!ms || ms < 1000) return '0m';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function todayDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

export function dateStr(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

// Returns [startISODate, endISODate] inclusive for the week containing `date` (Mon..Sun)
export function weekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [dateStr(monday), dateStr(sunday)];
}

export function monthRange(date = new Date()) {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [dateStr(first), dateStr(last)];
}

// Live ms accumulated this session for the active task (paused + currently running)
export function liveSessionMs(timerState) {
  if (timerState.status === 'stopped') return 0;
  let total = timerState.accumulatedMs || 0;
  if (timerState.status === 'running' && timerState.startTime) {
    total += Date.now() - new Date(timerState.startTime).getTime();
  }
  return total;
}

// Today's ms for a task = sum of today sessions + live (if this task is active and not stopped)
export function taskTodayMs(task, timerState) {
  const today = todayDate();
  let total = (task.sessions || [])
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.ms || 0), 0);
  if (task.id === timerState.activeTaskId) {
    total += liveSessionMs(timerState);
  }
  return total;
}

export function taskTotalMs(task, timerState) {
  let total = task.totalMs || 0;
  if (task.id === timerState.activeTaskId) {
    total += liveSessionMs(timerState);
  }
  return total;
}

export function taskMsInRange(task, fromDate, toDate) {
  return (task.sessions || [])
    .filter(s => s.date >= fromDate && s.date <= toDate)
    .reduce((sum, s) => sum + (s.ms || 0), 0);
}

// Range totals — include live time only if today is in range
export function totalMsInRange(tasks, timerState, fromDate, toDate) {
  let total = tasks.reduce((sum, t) => sum + taskMsInRange(t, fromDate, toDate), 0);
  const today = todayDate();
  if (today >= fromDate && today <= toDate) {
    total += liveSessionMs(timerState);
  }
  return total;
}

export function totalTodayMs(tasks, timerState) {
  const today = todayDate();
  return totalMsInRange(tasks, timerState, today, today);
}
