<script>
  import Chips from './components/Chips.svelte';
  import Icon from './components/Icon.svelte';
  import Detail from './components/Detail.svelte';
  import Search from './components/Search.svelte';
  import Overview from './pages/Overview.svelte';
  import Markets from './pages/Markets.svelte';
  import Portfolio from './pages/Portfolio.svelte';
  import Lab from './pages/Lab.svelte';
  import News from './pages/News.svelte';
  import { settings, ui, persist, goTab } from './lib/state.svelte.js';
  import { REGIONS, CURRENCIES, PERIODS } from './lib/catalog.js';
  import { clearCache } from './lib/net.js';
  import { live, startLive, pollNow, unread, dismiss } from './lib/live.svelte.js';
  import { untrack } from 'svelte';
  import { update, startUpdates, applyNow, BUILD } from './lib/update.svelte.js';

  const TABS = [
    { id: 'overview', label: 'Aperçu', icon: 'overview', page: Overview },
    { id: 'markets', label: 'Marchés', icon: 'stocks', page: Markets },
    { id: 'portfolio', label: 'Portefeuille', icon: 'wallet', page: Portfolio },
    { id: 'lab', label: 'Analyse', icon: 'lab', page: Lab },
    { id: 'news', label: 'Actualités', icon: 'news', page: News },
  ];
  const Page = $derived((TABS.find((t) => t.id === ui.tab) ?? TABS[0]).page);
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
    pollNow();
  }

  startLive();
  startUpdates();
  let updateHidden = $state(false);
  const fresh = $derived(unread());

  // Entrée sur l'onglet Actualités : les articles parus depuis le dernier passage sont marqués « Nouveau ».
  let prevTab = ui.tab;
  $effect(() => {
    const t = ui.tab;
    untrack(() => {
      if (t === 'news' && prevTab !== 'news') {
        live.mark = settings.newsReadAt;
        settings.newsReadAt = Date.now();
      } else if (t !== 'news' && prevTab === 'news') settings.newsReadAt = Date.now();
      prevTab = t;
    });
  });

  function openToast(t) {
    dismiss(t.id);
    if (t.kind === 'move') goTab('news');
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
    <button class="tab" class:on={ui.tab === t.id} onclick={() => goTab(t.id)}>
      <Icon name={t.icon} />{t.label}
      {#if t.id === 'news' && ui.tab !== 'news'}
        {#if fresh.important}
          <span class="count" aria-label="{fresh.important} alertes">{fresh.important > 99 ? '99+' : fresh.important}</span>
        {:else if fresh.any}
          <span class="count dot" aria-label="Nouveaux articles"></span>
        {/if}
      {/if}
    </button>
  {/each}
{/snippet}

<div class="shell">
  <nav class="side">
    {@render brand()}
    {@render tabs()}
    <div class="foot muted small">
      Données : Yahoo Finance, CoinGecko, BIS/FRED, BCE, flux RSS. Informations indicatives, pas un conseil en investissement.
      <br />Version {BUILD ? (update.native ? update.native.split('.')[0] + '.' : '') + BUILD : 'de développement'}
    </div>
  </nav>

  <div class="main">
    <header class="topbar">
      <div class="topbar-row">
        {@render brand()}
        <span class="spacer"></span>
        <button class="icon-btn" onclick={() => (ui.search = true)} aria-label="Rechercher une valeur"><Icon name="search" /></button>
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
        <select class="select only-narrow" bind:value={settings.region} aria-label="Région">
          {#each REGIONS as r}<option value={r.id}>{r.label}</option>{/each}
        </select>
        <Chips options={PERIODS} bind:value={settings.period} label="Période" />
      </div>
    </header>

    <main class="page">
      {#if update.state !== 'idle' && !updateHidden}
        <div class="card update">
          {#if update.state === 'ready'}
            <span style="flex:1;min-width:200px">
              <b>Mise à jour {update.version} prête.</b>
              <span class="muted">Elle s’appliquera au prochain lancement.</span>
            </span>
            <button class="btn" onclick={applyNow}>Redémarrer maintenant</button>
          {:else}
            <span style="flex:1;min-width:200px">
              <b>Nouvelle version {update.version} de l’application.</b>
              <span class="muted">Elle demande une réinstallation ; vos données sont conservées.</span>
            </span>
            <a class="btn" href={update.apk}>Télécharger</a>
          {/if}
          <button class="chip" onclick={() => (updateHidden = true)}>Plus tard</button>
        </div>
      {/if}
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

{#if ui.search || ui.picker}
  <Search />
{/if}

{#if live.toasts.length}
  <div class="toasts" aria-live="polite">
    {#each live.toasts as t (t.id)}
      <div class="toast {t.kind}">
        <span class="live-dot"></span>
        <span>
          <span class="k">{t.kind === 'move' ? 'Mouvement de marché' : 'Alerte actualité'}</span><br />
          {#if t.link}
            <a class="t" href={t.link} target="_blank" rel="noopener noreferrer" onclick={() => dismiss(t.id)}>{t.title}</a>
          {:else}
            <button class="t" style="text-align:left" onclick={() => openToast(t)}>{t.title}</button>
          {/if}
          <br /><span class="s">{t.sub}</span>
        </span>
        <button class="x" aria-label="Fermer" onclick={() => dismiss(t.id)}>×</button>
      </div>
    {/each}
  </div>
{/if}
