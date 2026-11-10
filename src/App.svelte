<script>
  import Chips from './components/Chips.svelte';
  import Icon from './components/Icon.svelte';
  import Detail from './components/Detail.svelte';
  import Overview from './pages/Overview.svelte';
  import Markets from './pages/Markets.svelte';
  import Crypto from './pages/Crypto.svelte';
  import RealEstate from './pages/RealEstate.svelte';
  import News from './pages/News.svelte';
  import { settings, ui, persist } from './lib/state.svelte.js';
  import { REGIONS, CURRENCIES, PERIODS } from './lib/catalog.js';
  import { clearCache } from './lib/net.js';

  const TABS = [
    { id: 'overview', label: 'Aperçu', icon: 'overview', page: Overview },
    { id: 'stocks', label: 'Actions', icon: 'stocks', page: Markets },
    { id: 'crypto', label: 'Crypto', icon: 'crypto', page: Crypto },
    { id: 'realestate', label: 'Immobilier', icon: 'home', page: RealEstate },
    { id: 'news', label: 'Actualités', icon: 'news', page: News },
  ];
  const Page = $derived(TABS.find((t) => t.id === ui.tab).page);
  let version = $state(0);

  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name=theme-color]').content = settings.theme === 'dark' ? '#0a0e15' : '#f3f5f9';
    JSON.stringify(settings); // lit tous les réglages : l'effet se relance à chaque changement
    persist();
  });

  function refresh() {
    clearCache();
    version++;
  }
  function go(id) {
    ui.tab = id;
    window.scrollTo(0, 0);
  }
</script>

<svelte:window onpopstate={() => (ui.detail = null)} />

{#snippet brand()}
  <div class="brand">
    <svg viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="var(--accent-soft)" />
      <path d="M10 44l12-12 9 7 12-17 11 9" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    BACUS
  </div>
{/snippet}

{#snippet tabs()}
  {#each TABS as t (t.id)}
    <button class="tab" class:on={ui.tab === t.id} onclick={() => go(t.id)}>
      <Icon name={t.icon} />{t.label}
    </button>
  {/each}
{/snippet}

<div class="shell">
  <nav class="side">
    {@render brand()}
    {@render tabs()}
    <div class="foot muted small">
      Données : Yahoo Finance, CoinGecko, BIS/FRED, flux RSS. Informations indicatives, pas un conseil en investissement.
    </div>
  </nav>

  <div class="main">
    <header class="topbar">
      <div class="topbar-row">
        {@render brand()}
        <span class="spacer"></span>
        <select class="select only-narrow" bind:value={settings.region} aria-label="Région">
          {#each REGIONS as r}<option value={r.id}>{r.label}</option>{/each}
        </select>
        <select class="select" bind:value={settings.currency} aria-label="Devise">
          {#each CURRENCIES as c}<option value={c.id}>{c.id}</option>{/each}
        </select>
        <button class="icon-btn" onclick={refresh} aria-label="Actualiser"><Icon name="refresh" /></button>
        <button
          class="icon-btn"
          onclick={() => (settings.theme = settings.theme === 'dark' ? 'light' : 'dark')}
          aria-label="Changer de thème"
        >
          <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
      <div class="filters">
        <span class="only-wide" style="gap:10px;align-items:center">
          <Chips options={REGIONS} bind:value={settings.region} label="Région" />
          <span class="sep"></span>
        </span>
        <Chips options={PERIODS} bind:value={settings.period} label="Période" />
      </div>
    </header>

    <main class="page">
      {#key version}
        <Page />
      {/key}
    </main>
  </div>

  <nav class="tabbar">{@render tabs()}</nav>
</div>

{#if ui.detail}
  {#key ui.detail.id}
    <Detail asset={ui.detail} />
  {/key}
{/if}
