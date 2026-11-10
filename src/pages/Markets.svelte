<script>
  import Row from '../components/Row.svelte';
  import { settings, openDetail } from '../lib/state.svelte.js';
  import { INDICES, STOCKS, inRegion } from '../lib/catalog.js';
  import { quotes } from '../lib/data.js';
  import { price } from '../lib/format.js';

  let kind = $state('index');
  let sector = $state('');
  let sort = $state('default');
  let search = $state('');

  const base = $derived(inRegion(kind === 'index' ? INDICES : STOCKS, settings.region));
  const sectors = $derived([...new Set(inRegion(STOCKS, settings.region).map((a) => a.sector))].sort());
  const load = $derived(quotes(base, settings.period, settings.currency));

  function view(q) {
    const s = search.trim().toLowerCase();
    const list = base
      .filter((a) => kind === 'index' || !sector || a.sector === sector)
      .filter((a) => !s || a.name.toLowerCase().includes(s) || a.s.toLowerCase().includes(s))
      .map((a) => ({ a, q: q.get(a.id) }))
      .filter((x) => x.q);
    if (sort === 'up') list.sort((x, y) => y.q.change - x.q.change);
    if (sort === 'down') list.sort((x, y) => x.q.change - y.q.change);
    if (sort === 'name') list.sort((x, y) => x.a.name.localeCompare(y.a.name));
    return list;
  }
</script>

<h1 class="title">Actions et indices</h1>

<div class="toolbar">
  <div class="seg">
    <button class:on={kind === 'index'} onclick={() => (kind = 'index')}>Indices</button>
    <button class:on={kind === 'stock'} onclick={() => (kind = 'stock')}>Actions</button>
  </div>
  <input class="input" type="search" placeholder="Rechercher…" bind:value={search} />
  {#if kind === 'stock'}
    <select class="select" bind:value={sector} aria-label="Secteur">
      <option value="">Tous les secteurs</option>
      {#each sectors as s}<option>{s}</option>{/each}
    </select>
  {/if}
  <select class="select" bind:value={sort} aria-label="Tri">
    <option value="default">Tri par défaut</option>
    <option value="up">Plus fortes hausses</option>
    <option value="down">Plus fortes baisses</option>
    <option value="name">Nom</option>
  </select>
</div>

{#await load}
  {#each Array(6) as _}<div class="skel"></div>{/each}
{:then q}
  <div class="card flush">
    {#each view(q) as x (x.a.id)}
      <Row
        name={x.a.name}
        sub={kind === 'index' ? `${x.a.s} · points` : `${x.a.s} · ${x.a.sector}`}
        avatar={x.a.s.replace('^', '').slice(0, 3)}
        priceText={price(x.q.price, x.q.cur)}
        change={x.q.change}
        spark={x.q.spark}
        onclick={() => openDetail(x.a)}
      />
    {:else}
      <div class="empty">Aucun résultat avec ces filtres.</div>
    {/each}
  </div>
  <p class="muted small">
    Les indices sont exprimés en points, sans conversion. Les actions sont converties dans la devise choisie, avec les taux
    de change de chaque date : la variation affichée est celle que vous auriez réellement constatée dans cette devise.
  </p>
{:catch}
  <div class="card error">Impossible de charger les cotations. Vérifiez la connexion.</div>
{/await}
