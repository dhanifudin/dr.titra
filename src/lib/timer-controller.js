import { get } from 'svelte/store';
import { api } from './api.js';
import {
  localTasks,
  settings,
  timerState,
  persistLocalTasks,
  persistTimerState,
  setError,
} from './store.js';
import { liveSessionMs, todayDate } from './time.js';

export async function commitActiveSession(snapshot = get(timerState), { sendEntry = false } = {}) {
  if (snapshot.status === 'stopped' || !snapshot.activeTaskId) return 0;

  const sessionMs = liveSessionMs(snapshot);
  const { apiToken, baseUrl } = get(settings);

  if (snapshot.status === 'running' && apiToken) {
    try { await api.stopTimer(apiToken, baseUrl); } catch {}
  }

  if (sessionMs <= 0) return 0;

  const date = todayDate();
  const entry = { date, ms: sessionMs, endedAt: new Date().toISOString() };
  const tasks = get(localTasks);
  const updated = tasks.map((task) => (
    task.id === snapshot.activeTaskId
      ? { ...task, totalMs: (task.totalMs || 0) + sessionMs, sessions: [...(task.sessions || []), entry] }
      : task
  ));

  await persistLocalTasks(updated);

  if (sendEntry && sessionMs >= 60000) {
    const task = updated.find((t) => t.id === snapshot.activeTaskId);
    if (task?.projectId && apiToken) {
      const hours = parseFloat((sessionMs / 3600000).toFixed(2));
      try {
        await api.createTimeEntry(apiToken, baseUrl, {
          projectId: task.projectId,
          task: task.text || 'Time entry from Dr.titra',
          date,
          hours: Math.max(hours, 0.01),
        });
      } catch (error) {
        setError(`Titra entry failed: ${error?.message || String(error)}`);
      }
    }
  }

  return sessionMs;
}

export async function startTask(taskId) {
  const { apiToken, baseUrl } = get(settings);
  if (!apiToken) {
    setError('Add your API token in Settings first.');
    return;
  }

  const snapshot = get(timerState);

  if (snapshot.activeTaskId && snapshot.activeTaskId !== taskId && snapshot.status !== 'stopped') {
    await commitActiveSession(snapshot, { sendEntry: true });
  }

  // Ensure no stale backend timer is running before starting (idempotent no-op if already stopped)
  try { await api.stopTimer(apiToken, baseUrl); } catch {}

  try {
    const response = await api.startTimer(apiToken, baseUrl);
    const startTime = response?.payload?.startTime || new Date().toISOString();
    await persistTimerState({
      status: 'running',
      startTime,
      accumulatedMs: snapshot.activeTaskId === taskId ? (snapshot.accumulatedMs || 0) : 0,
      activeTaskId: taskId,
    });
  } catch (error) {
    setError(error?.message || String(error));
  }
}

export async function pauseTimer() {
  const snapshot = get(timerState);
  if (snapshot.status !== 'running') return;

  await commitActiveSession(snapshot, { sendEntry: true });

  try {
    await persistTimerState({
      ...snapshot,
      status: 'paused',
      startTime: null,
      accumulatedMs: 0,
    });
  } catch (error) {
    setError(error?.message || String(error));
  }
}

export async function reconcileTimer() {
  const { apiToken, baseUrl } = get(settings);
  const snapshot = get(timerState);

  if (snapshot.status !== 'running' || !apiToken || !baseUrl) return;

  try {
    await api.getTimer(apiToken, baseUrl);
  } catch {
    const currentState = get(timerState);
    if (
      currentState.status === 'running'
      && currentState.activeTaskId === snapshot.activeTaskId
      && currentState.startTime === snapshot.startTime
    ) {
      await persistTimerState({ ...currentState, status: 'paused', startTime: null });
    }
  }
}
