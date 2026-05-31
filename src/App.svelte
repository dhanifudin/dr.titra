<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { view, settings, timerState, minimal, initStore } from './lib/store.js';
  import { reconcileTimer } from './lib/timer-controller.js';
  import TitleBar from './lib/TitleBar.svelte';
  import Timer from './lib/Timer.svelte';
  import TaskList from './lib/TaskList.svelte';
  import Settings from './lib/Settings.svelte';
  import Dashboard from './lib/Dashboard.svelte';
  import MinimalView from './lib/MinimalView.svelte';
  import Onboarding from './lib/Onboarding.svelte';

  onMount(async () => {
    await initStore();

    const { apiToken, baseUrl } = get(settings);
    if (!apiToken || !baseUrl) {
      view.set('onboarding');
    } else if (get(timerState).status === 'running') {
      await reconcileTimer();
    }

    const unlisten = await listen('open-settings', () => {
      minimal.set(false);
      view.set('settings');
    });
    return unlisten;
  });

  $: if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', $settings.theme || 'dark');
  }

  // Keep tray icon color in sync with timer state
  $: invoke('set_tray_icon', { status: $timerState.status }).catch(() => {});
</script>

{#if $minimal}
  <MinimalView />
{:else}
  <div class="app">
    <TitleBar />

    {#if $view === 'onboarding'}
      <Onboarding />
    {:else if $view === 'settings'}
      <Settings />
    {:else if $view === 'dashboard'}
      <Dashboard />
    {:else}
      <Timer />
      <TaskList />
    {/if}
  </div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
    overflow: hidden;
  }
</style>
