import { writable, get } from 'svelte/store';
import { LazyStore } from '@tauri-apps/plugin-store';

const persist = new LazyStore('dr-titra.json');

export const settings = writable({
  apiToken: '',
  baseUrl: 'https://titra.nusaraya.co.id',
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

export async function initStore() {
  const savedSettings = await persist.get('settings');
  if (savedSettings) settings.set({ theme: 'dark', ...savedSettings });

  const savedTimer = await persist.get('timerState');
  if (savedTimer) timerState.set({ activeTaskId: null, ...savedTimer });

  const savedTasks = await persist.get('localTasks');
  if (savedTasks) localTasks.set(savedTasks.map(normalizeTask));
}

export async function persistSettings(s) {
  settings.set(s);
  await persist.set('settings', s);
  await persist.save();
}

export async function persistTimerState(ts) {
  timerState.set(ts);
  await persist.set('timerState', ts);
  await persist.save();
}

export async function persistLocalTasks(tasks) {
  localTasks.set(tasks);
  await persist.set('localTasks', tasks);
  await persist.save();
}
