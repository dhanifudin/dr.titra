import { writable } from 'svelte/store';
import { LazyStore } from '@tauri-apps/plugin-store';

const persist = new LazyStore('dr-titra.json');

export const settings = writable({
  apiToken: '',
  baseUrl: '',
  theme: 'dark',
});

export const timerState = writable({
  status: 'stopped',     // 'stopped' | 'running' | 'paused'
  startTime: null,       // ISO string of the current API timer session start
  accumulatedMs: 0,      // ms accumulated this session across pauses
  activeTaskId: null,    // id of the task being timed
});

// Task: { id, text, projectId, projectName, done, totalMs, createdAt, completedAt }
export const localTasks = writable([]);
export const projects = writable([]);
export const view = writable('widget');
export const errorMsg = writable('');

// UI state — ephemeral, not persisted
export const activeProjectTab = writable(undefined); // undefined = not yet initialized, null = "Unassigned", string = projectId
export const minimal = writable(false);

let errorTimer = null;

function logTimerState(event, state) {
  console.debug(`[timer] ${event}`, {
    status: state.status,
    activeTaskId: state.activeTaskId,
    startTime: state.startTime,
    accumulatedMs: state.accumulatedMs,
  });
}

export function setError(msg) {
  errorMsg.set(msg);
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => errorMsg.set(''), 5000);
}

function normalizeTask(t) {
  return {
    id: t.id,
    text: t.text || '',
    projectId: t.projectId || null,
    projectName: t.projectName || '',
    done: !!t.done,
    totalMs: t.totalMs || 0,
    sessions: Array.isArray(t.sessions) ? t.sessions : [],  // [{ date, ms, endedAt }]
    createdAt: t.createdAt || new Date().toISOString(),
    completedAt: t.completedAt || null,
  };
}

export function normalizeTimerState(ts) {
  if (ts.status === 'running') {
    if (!ts.activeTaskId) {
      return {
        status: 'stopped',
        startTime: null,
        accumulatedMs: 0,
        activeTaskId: null,
      };
    }

    if (!ts.startTime) {
      return {
        status: 'paused',
        startTime: null,
        accumulatedMs: ts.accumulatedMs || 0,
        activeTaskId: ts.activeTaskId,
      };
    }

    return {
      status: 'running',
      startTime: ts.startTime,
      accumulatedMs: ts.accumulatedMs || 0,
      activeTaskId: ts.activeTaskId,
    };
  }

  if (ts.status === 'paused') {
    if (!ts.activeTaskId) {
      return {
        status: 'stopped',
        startTime: null,
        accumulatedMs: 0,
        activeTaskId: null,
      };
    }

    return {
      status: 'paused',
      startTime: null,
      accumulatedMs: ts.accumulatedMs || 0,
      activeTaskId: ts.activeTaskId,
    };
  }

  return {
    status: 'stopped',
    startTime: null,
    accumulatedMs: 0,
    activeTaskId: null,
  };
}

export async function initStore() {
  const savedSettings = await persist.get('settings');
  if (savedSettings) settings.set({ theme: 'dark', ...savedSettings });

  const savedTimer = await persist.get('timerState');
  if (savedTimer) timerState.set(normalizeTimerState({ activeTaskId: null, ...savedTimer }));

  const savedTasks = await persist.get('localTasks');
  if (savedTasks) localTasks.set(savedTasks.map(normalizeTask));
}

export async function persistSettings(s) {
  settings.set(s);
  await persist.set('settings', s);
  await persist.save();
}

export async function persistTimerState(ts) {
  const next = normalizeTimerState(ts);
  logTimerState('persistTimerState', next);
  timerState.set(next);
  await persist.set('timerState', next);
  await persist.save();
}

export async function persistLocalTasks(tasks) {
  localTasks.set(tasks);
  await persist.set('localTasks', tasks);
  await persist.save();
}
