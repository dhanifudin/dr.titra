<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { open } from '@tauri-apps/plugin-shell';
  import { settings, persistSettings, projects, view } from './store.js';
  import { api, normalizeBaseUrl } from './api.js';

  let token = '';
  let baseUrl = '';
  let theme = 'dark';
  let testing = false;
  let testResult = '';
  let saving = false;

  onMount(() => {
    const s = get(settings);
    token = s.apiToken;
    baseUrl = s.baseUrl || '';
    theme = s.theme || 'dark';
  });

  async function save() {
    saving = true;
    try {
      const cleanUrl = normalizeBaseUrl(baseUrl);
      await persistSettings({
        apiToken: token.trim(),
        baseUrl: cleanUrl,
        theme,
      });
      view.set('widget');
    } catch (e) {
      testResult = `✗ ${e?.message || String(e)}`;
    } finally {
      saving = false;
    }
  }

  async function applyTheme(next) {
    theme = next;
    // Apply immediately for live preview; persist on save
    document.documentElement.setAttribute('data-theme', next);
  }

  async function testConnection() {
    if (!baseUrl.trim()) {
      testResult = '✗ Enter your Titra server URL first.';
      return;
    }
    if (!token.trim()) {
      testResult = '✗ Enter an API token first.';
      return;
    }
    testing = true;
    testResult = '';
    try {
      const cleanUrl = normalizeBaseUrl(baseUrl);
      const res = await api.listProjects(
        token.trim(),
        cleanUrl
      );
      const list = res.payload || [];
      projects.set(list);
      testResult = `✓ Connected – ${list.length} project${list.length !== 1 ? 's' : ''} found.`;
    } catch (e) {
      testResult = `✗ ${e?.message || String(e)}`;
    } finally {
      testing = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') save();
  }

  async function openTokenPage() {
    try {
      const url = normalizeBaseUrl(baseUrl);
      await open(`${url}/settings`);
    } catch (e) {
      testResult = `✗ ${e?.message || String(e)}`;
    }
  }
</script>

<div class="settings">
  <h2>Settings</h2>

  <div class="form-group">
    <label for="url">Server URL</label>
    <input
      id="url"
      type="url"
      bind:value={baseUrl}
      placeholder="https://your-titra-server.example"
      on:keydown={handleKeydown}
    />
    <button class="get-token-link" on:click={openTokenPage} type="button">
      Get API token from titra ↗
    </button>
    <p class="field-hint">Open Settings, then go to Integrations, choose titra, and click Generate to create the required token.</p>
  </div>

  <div class="form-group">
    <label for="token">API Token</label>
    <input
      id="token"
      type="password"
      bind:value={token}
      placeholder="Paste your titra API token"
      on:keydown={handleKeydown}
    />
  </div>

  <div class="form-group">
    <label for="theme-toggle">Theme</label>
    <div class="theme-toggle" id="theme-toggle">
      <button
        class="theme-btn"
        class:active={theme === 'dark'}
        on:click={() => applyTheme('dark')}
        type="button"
      >🌙 Dark</button>
      <button
        class="theme-btn"
        class:active={theme === 'light'}
        on:click={() => applyTheme('light')}
        type="button"
      >☀ Light</button>
    </div>
  </div>

  {#if testResult}
    <p class="test-result" class:ok={testResult.startsWith('✓')} class:fail={testResult.startsWith('✗')}>
      {testResult}
    </p>
  {/if}

  <div class="actions">
    <button on:click={testConnection} disabled={testing}>
      {testing ? 'Testing…' : 'Test Connection'}
    </button>
    <button class="btn-primary" on:click={save} disabled={saving}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
</div>

<style>
  .settings {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
  }

  h2 {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 14px;
  }

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .get-token-link {
    background: transparent;
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
    padding: 0;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .get-token-link:hover:not(:disabled) {
    opacity: 0.75;
    background: transparent;
  }

  .field-hint {
    font-size: 11px;
    color: var(--text-dim);
    margin: 0;
  }

  .theme-toggle {
    display: flex;
    gap: 6px;
  }

  .theme-btn {
    flex: 1;
    background: var(--surface);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }

  .theme-btn.active {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }

  .test-result {
    font-size: 12px;
    padding: 8px 10px;
    border-radius: 6px;
    margin-bottom: 14px;
  }

  .test-result.ok {
    background: color-mix(in srgb, var(--green) 15%, transparent);
    color: var(--green);
  }

  .test-result.fail {
    background: color-mix(in srgb, var(--red) 15%, transparent);
    color: var(--red);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
    font-weight: 600;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
</style>
