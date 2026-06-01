<script>
  import { get } from 'svelte/store';
  import { open } from '@tauri-apps/plugin-shell';
  import { settings, persistSettings, projects, view } from './store.js';
  import { api, normalizeBaseUrl } from './api.js';

  let token = '';
  let baseUrl = '';
  let connecting = false;
  let error = '';

  async function openTokenPage() {
    try {
      const url = normalizeBaseUrl(baseUrl);
      await open(`${url}/settings`);
    } catch (e) {
      error = `Could not open browser: ${e?.message || String(e)}`;
    }
  }

  async function connect() {
    error = '';
    if (!baseUrl.trim()) { error = 'Enter your Titra server URL first.'; return; }
    if (!token.trim()) { error = 'Paste your API token first.'; return; }
    connecting = true;
    try {
      const cleanUrl = normalizeBaseUrl(baseUrl);
      const res = await api.listProjects(token.trim(), cleanUrl);
      const list = res.payload || [];
      projects.set(list);
      await persistSettings({
        apiToken: token.trim(),
        baseUrl: cleanUrl,
        theme: get(settings).theme || 'dark',
      });
      view.set('widget');
    } catch (e) {
      error = e?.message || String(e);
    } finally {
      connecting = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') connect();
  }
</script>

<div class="onboarding">
  <div class="hero">
    <span class="hero-icon">⏱</span>
    <h1>Welcome to Dr.titra</h1>
    <p class="tagline">Connect your titra account to start tracking time.</p>
  </div>

  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-body">
        <label class="step-label" for="baseurl">Enter your Titra server URL</label>
        <input
          id="baseurl"
          type="url"
          bind:value={baseUrl}
          placeholder="https://your-titra-server.example"
          on:keydown={handleKeydown}
          autocomplete="url"
          spellcheck="false"
        />
        <p class="step-hint">Use your company or self-hosted Titra address.</p>
      </div>
    </div>

    <div class="step">
      <div class="step-num">2</div>
      <div class="step-body">
        <p class="step-label">Open your Titra server and copy your API token</p>
        <button class="token-link" on:click={openTokenPage}>
          <span class="token-link-text">Open titra settings</span>
          <span class="token-link-ext">↗</span>
        </button>
        <p class="step-hint">After the settings page opens, go to Integrations, choose titra, then click Generate to create the required token.</p>
      </div>
    </div>

    <div class="step">
      <div class="step-num">3</div>
      <div class="step-body">
        <p class="step-label">Paste your API token below</p>
        <input
          type="password"
          bind:value={token}
          placeholder="Paste token here…"
          on:keydown={handleKeydown}
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button
    class="btn-connect"
    on:click={connect}
    disabled={connecting || !baseUrl.trim() || !token.trim()}
  >
    {#if connecting}
      <span class="spinner"></span> Connecting…
    {:else}
      Connect & Start Tracking
    {/if}
  </button>

</div>

<style>
  .onboarding {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 18px 18px;
    overflow-y: auto;
    gap: 14px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-bottom: 6px;
  }

  .hero-icon {
    font-size: 36px;
    line-height: 1;
  }

  h1 {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    margin: 0;
    letter-spacing: 0.2px;
  }

  .tagline {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    margin: 0;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .step {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 12px 12px 10px;
  }

  .step-num {
    width: 22px;
    height: 22px;
    min-width: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--bg);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .step-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .step-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .step-hint {
    font-size: 10px;
    color: var(--text-dim);
    margin: 0;
  }

  .token-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: 7px;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    transition: background 0.15s, opacity 0.15s;
  }

  .token-link:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 26%, transparent);
    opacity: 1;
  }

  .token-link-text {
    flex: 1;
  }

  .token-link-ext {
    font-size: 14px;
    font-weight: 700;
  }

  .error {
    font-size: 11px;
    color: var(--red);
    background: color-mix(in srgb, var(--red) 12%, transparent);
    border-radius: 6px;
    padding: 8px 10px;
    margin: 0;
  }

  .btn-connect {
    width: 100%;
    background: var(--accent);
    color: var(--bg);
    font-weight: 700;
    font-size: 13px;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.15s;
  }

  .btn-connect:hover:not(:disabled) {
    opacity: 0.88;
  }

  .btn-connect:disabled {
    opacity: 0.4;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid color-mix(in srgb, var(--bg) 40%, transparent);
    border-top-color: var(--bg);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
