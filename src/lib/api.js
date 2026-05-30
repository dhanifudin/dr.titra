import { fetch } from '@tauri-apps/plugin-http';

const DEFAULT_BASE_URL = 'https://titra.nusaraya.co.id';

async function request(token, baseUrl, method, path, body = null) {
  const url = `${baseUrl || DEFAULT_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: Invalid JSON response`);
  }

  if (!res.ok || (data.statusCode && data.statusCode !== 200)) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  listProjects: (token, baseUrl) =>
    request(token, baseUrl, 'GET', '/project/list/'),

  listTasks: (token, baseUrl, projectId) =>
    request(token, baseUrl, 'GET', `/project/tasks/${projectId}`),

  createTask: (token, baseUrl, data) =>
    request(token, baseUrl, 'POST', '/project/task/create/', data),

  startTimer: (token, baseUrl) =>
    request(token, baseUrl, 'POST', '/timer/start/'),

  getTimer: (token, baseUrl) =>
    request(token, baseUrl, 'GET', '/timer/get/'),

  stopTimer: (token, baseUrl) =>
    request(token, baseUrl, 'POST', '/timer/stop/'),

  createTimeEntry: (token, baseUrl, data) =>
    request(token, baseUrl, 'POST', '/timeentry/create/', data),
};
