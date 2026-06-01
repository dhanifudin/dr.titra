<script>
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { LogicalSize } from '@tauri-apps/api/dpi';
  import { view, minimal } from './store.js';

  async function minimize() { await getCurrentWindow().minimize(); }
  async function hideToTray() { await getCurrentWindow().hide(); }

  function showWidget() { view.set('widget'); }
  function showDashboard() { view.set('dashboard'); }
  function showSettings() { view.set('settings'); }

  function handleBrandKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showWidget();
    }
  }

  async function enterMinimal() {
    try {
      await getCurrentWindow().setSize(new LogicalSize(360, 56));
      minimal.set(true);
    } catch (e) {
      console.error('Failed to enter minimal mode', e);
    }
  }
</script>

<div class="titlebar" data-tauri-drag-region>
  <div
    class="brand"
    data-tauri-drag-region
    on:dblclick={showWidget}
    on:keydown={handleBrandKeydown}
    role="button"
    tabindex="0"
    aria-label="Show tasks view"
  >
    <span class="icon">⏱</span>
    <span class="name">Dr.titra</span>
  </div>
  <div class="actions">
    <div class="nav">
      <button
        class="icon-btn"
        class:active={$view === 'widget'}
        title="Tasks"
        on:click={showWidget}
      >☰</button>
      <button
        class="icon-btn"
        class:active={$view === 'dashboard'}
        title="Dashboard"
        on:click={showDashboard}
      >▦</button>
      <button
        class="icon-btn"
        class:active={$view === 'settings'}
        title="Settings"
        on:click={showSettings}
      >⚙</button>
    </div>
    <span class="sep"></span>
    <button
      class="icon-btn"
      title="Compact view"
      on:click={enterMinimal}
    >▭</button>
    <button class="icon-btn" title="Minimize" on:click={minimize}>−</button>
    <button class="icon-btn close" title="Hide to tray" on:click={hideToTray}>×</button>
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    cursor: default;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
  }

  .icon { font-size: 15px; }

  .name {
    font-weight: 700;
    font-size: 14px;
    color: var(--accent);
    letter-spacing: 0.3px;
  }

  .actions { display: flex; gap: 2px; align-items: center; }

  .nav {
    display: flex;
    gap: 1px;
    background: var(--bg);
    padding: 2px;
    border-radius: 6px;
  }

  .sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-dim);
    width: 26px;
    height: 26px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }

  .icon-btn:hover {
    background: var(--surface2);
    color: var(--text);
    opacity: 1;
  }

  .icon-btn.active {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--accent);
  }

  .icon-btn.close:hover {
    background: var(--red);
    color: var(--bg);
  }
</style>
