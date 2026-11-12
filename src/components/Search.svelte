<script>
  import Icon from './Icon.svelte';
  import { ui, openDetail } from '../lib/state.svelte.js';
  import { UNIVERSE, CLASSES } from '../lib/catalog.js';
  import { searchAssets, resolveAsset } from '../lib/data.js';

  // Sert à la fois de recherche globale (ouvre la fiche) et de sélecteur pour les outils (ui.picker).
  const picker = ui.picker;
  let q = $state('');
  let remote = $state([]);
  let busy = $state(false);
  let failed = $state(false);
  let input;

  $effect(() => input?.focus());

  const local = $derived.by(() => {
    const s = q.trim().toLowerCase();
    const pool = UNIVERSE.filter((a) => !picker?.filter || picker.filter(a));
    if (!s) return pool.filter((a) => ['^FCHI', '^GSPC', '^IXIC', 'BTC-USD', 'GC=F', 'MC.PA', 'NVDA', 'VNQ'].includes(a.id));
    return pool.filter((a) => a.name.toLowerCase().includes(s) || a.s.toLowerCase().includes(s)).slice(0, 6);
  });

  $effect(() => {
    const s = q.trim();
    failed = false;
    if (s.length < 2) {
      remote = [];
      return;
    }
    busy = true;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchAssets(s);
        if (!stale) remote = res.filter((a) => !UNIVERSE.some((u) => u.id === a.id) && (!picker?.filter || picker.filter(a)));
      } catch {
        if (!stale) failed = true;
      } finally {
        if (!stale) busy = false;
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  });

  function close() {
    ui.search = false;
    ui.picker = null;
  }
  async function choose(a) {
    let asset = a;
    try {
      asset = await resolveAsset(a);
    } catch {
      asset = { ...a, cur: null };
    }
    if (picker) {
      picker.onpick(asset);
      close();
    } else openDetail(asset);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="sheet">
  <div class="sheet-head">
    <button class="icon-btn" onclick={close} aria-label="Fermer"><Icon name="back" /></button>
    <input class="input" type="search" bind:this={input} bind:value={q}
      placeholder={picker?.title ?? 'Action, ETF, indice, crypto… (ex. Renault, MSCI World)'} />
  </div>
  <div class="page">
    <div>
      <div class="section-title"><h2>{q.trim() ? 'Dans la sélection BACUS' : 'Suggestions'}</h2></div>
      <div class="card flush">
        {#each local as a (a.id)}
          <button class="row simple" onclick={() => choose(a)}>
            <span class="avatar">{a.s.replace('^', '').slice(0, 3)}</span>
            <span style="min-width:0">
              <span class="name" style="display:block">{a.name}</span>
              <span class="sub" style="display:block">{a.s} · {a.sector ?? CLASSES[a.kind]?.label}</span>
            </span>
          </button>
        {:else}
          <div class="empty">Rien dans la sélection.</div>
        {/each}
      </div>
    </div>

    {#if q.trim().length >= 2}
      <div>
        <div class="section-title"><h2>Tous les marchés</h2></div>
        {#if busy && !remote.length}
          <div class="skel"></div>
        {:else if failed}
          <div class="card empty">La recherche étendue ne répond pas.</div>
        {:else}
          <div class="card flush">
            {#each remote as a (a.id)}
              <button class="row simple" onclick={() => choose(a)}>
                <span class="avatar">{a.s.replace('^', '').slice(0, 3)}</span>
                <span style="min-width:0">
                  <span class="name" style="display:block">{a.name}</span>
                  <span class="sub" style="display:block">{a.s} · {a.sector}</span>
                </span>
              </button>
            {:else}
              <div class="empty">Aucun autre résultat.</div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <p class="muted small">La recherche couvre toutes les valeurs référencées par Yahoo Finance, au-delà de la sélection affichée dans les onglets.</p>
    {/if}
  </div>
</div>
