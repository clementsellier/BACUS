<script>
  import Row from '../components/Row.svelte';
  import { settings, openDetail } from '../lib/state.svelte.js';
  import { INDICES, STOCKS, inRegion } from '../lib/catalog.js';
  import { quotes } from '../lib/data.js';
  import { price, pct, dir } from '../lib/format.js';

  let kind = $state('index');
  let view = $state('list');
  let sector = $state('');
  let sort = $state('default');
  let search = $state('');

  const base = $derived(inRegion(kind === 'index' ? INDICES : STOCKS, settings.region));
  const sectors = $derived([...new Set(inRegion(STOCKS, settings.region).map((a) => a.sector))].sort());
  const load = $derived(quotes(base, settings.period, settings.currency));

  function rows(q) {
    const s = search.trim().toLowerCase();
    const list = base
      .filter((a) => kind === 'index' || !sector || a.sector === sector)
      .filter((a) => !s || a.name.toLowerCase().includes(s) || a.s.toLowerCase().includes(s))
      .map((a) => ({ a, q: q.get(a.id) }))
      .filter((x) => x.q);
    if (sort === 'up' || view === 'map') list.sort((x, y) => y.q.change - x.q.change);
    if (sort === 'down') list.sort((x, y) => x.q.change - y.q.change);
    if (sort === 'name') list.sort((x, y) => x.a.name.localeCompare(y.a.name));
    return list;
  }
  /** Moyenne des variations par secteur : qui profite, qui souffre. */
  function bySector(q) {
    const m = new Map();
    for (const a of base) {
      const x = q.get(a.id);
      if (!x) continue;
      const e = m.get(a.sector) ?? { sum: 0, n: 0 };
      e.sum += x.change;
      e.n++;
      m.set(a.sector, e);
    }
    const out = [...m].map(([name, e]) => ({ name, change: e.sum / e.n, n: e.n })).sort((x, y) => y.change - x.change);
    return { out, max: Math.max(...out.map((s) => Math.abs(s.change)), 0.0001) };
  }
  // Intensité de couleur proportionnelle à l'ampleur, plafonnée pour rester lisible
  const heat = (c, max) =>
    `background:color-mix(in srgb, var(--${c >= 0 ? 'up' : 'down'}) ${Math.round(12 + Math.min(1, Math.abs(c) / max) * 58)}%, var(--surface))`;
</script>

<div class="toolbar">
  <div class="seg">
    <button class:on={kind === 'index'} onclick={() => (kind = 'index')}>Indices</button>
    <button class:on={kind === 'stock'} onclick={() => (kind = 'stock')}>Actions</button>
  </div>
  <div class="seg">
    <button class:on={view === 'list'} onclick={() => (view = 'list')}>Liste</button>
    <button class:on={view === 'map'} onclick={() => (view = 'map')}>Carte</button>
  </div>
  <input class="input" type="search" placeholder="Filtrer…" bind:value={search} />
  {#if kind === 'stock'}
    <select class="select" bind:value={sector} aria-label="Secteur">
      <option value="">Tous les secteurs</option>
      {#each sectors as s}<option>{s}</option>{/each}
    </select>
  {/if}
  {#if view === 'list'}
    <select class="select" bind:value={sort} aria-label="Tri">
      <option value="default">Tri par défaut</option>
      <option value="up">Plus fortes hausses</option>
      <option value="down">Plus fortes baisses</option>
      <option value="name">Nom</option>
    </select>
  {/if}
</div>

{#await load}
  {#each Array(6) as _}<div class="skel"></div>{/each}
{:then q}
  {@const list = rows(q)}
  {#if kind === 'stock' && !sector && !search}
    {@const s = bySector(q)}
    <div class="card">
      <div class="section-title"><h2>Secteurs : qui profite, qui souffre</h2></div>
      {#each s.out as x (x.name)}
        <button class="div-row" onclick={() => (sector = x.name)}>
          <span class="div-label">{x.name}</span>
          <span class="div-track">
            <span class="div-fill {dir(x.change)}" style="width:{(Math.abs(x.change) / s.max) * 50}%;{x.change >= 0 ? 'left:50%' : 'right:50%'}"></span>
          </span>
          <b class="num {dir(x.change)}">{pct(x.change, 1)}</b>
        </button>
      {/each}
      <p class="muted small" style="margin-top:8px">Moyenne simple des valeurs suivies dans chaque secteur. Touchez un secteur pour le détailler.</p>
    </div>
  {/if}

  {#if view === 'map'}
    {@const max = Math.max(...list.map((x) => Math.abs(x.q.change)), 0.0001)}
    <div class="heat">
      {#each list as x (x.a.id)}
        <button class="heat-cell" style={heat(x.q.change, max)} onclick={() => openDetail(x.a)}>
          <span class="name">{x.a.name}</span>
          <b class="num">{pct(x.q.change, 1)}</b>
        </button>
      {:else}
        <div class="empty">Aucun résultat avec ces filtres.</div>
      {/each}
    </div>
  {:else}
    <div class="card flush">
      {#each list as x (x.a.id)}
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
  {/if}
  <p class="muted small">
    Les indices sont exprimés en points, sans conversion. Les actions sont converties dans la devise choisie avec les taux de
    change de chaque date. Une valeur absente ? Utilisez la loupe en haut de l’écran.
  </p>
{:catch}
  <div class="card error">Impossible de charger les cotations. Vérifiez la connexion.</div>
{/await}
