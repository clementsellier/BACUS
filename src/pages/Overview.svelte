<script>
  import Row from '../components/Row.svelte';
  import Spark from '../components/Spark.svelte';
  import { settings, ui, openDetail } from '../lib/state.svelte.js';
  import { INDICES, STOCKS, REITS, MACRO, REGIONS, PERIODS, inRegion } from '../lib/catalog.js';
  import { quotes, cryptoMarkets } from '../lib/data.js';
  import { loadNews, ago } from '../lib/news.js';
  import { pulse } from '../lib/analytics.js';
  import { price, pct, dir } from '../lib/format.js';

  const indices = $derived(inRegion(INDICES, settings.region));
  const stocks = $derived(inRegion(STOCKS, settings.region));
  const favs = $derived([...INDICES, ...STOCKS, ...REITS].filter((a) => settings.favorites.includes(a.id)));
  const load = $derived(
    quotes([...new Set([...indices, ...stocks, ...MACRO, ...favs])], settings.period, settings.currency),
  );
  const crypto = $derived(cryptoMarkets(settings.currency).catch(() => []));
  const news = $derived(loadNews().catch(() => []));

  const regionLabel = $derived(REGIONS.find((r) => r.id === settings.region).label);
  const periodLong = $derived(PERIODS.find((p) => p.id === settings.period).long);

  function summary(p, q) {
    const parts = [`${p.up} indice${p.up > 1 ? 's' : ''} sur ${p.total} en hausse ${periodLong} (moyenne ${pct(p.avg, 1)}).`];
    const vix = q.get('^VIX')?.price;
    if (vix) {
      parts.push(
        vix >= 25
          ? `Le VIX à ${vix.toFixed(0)} signale un marché nerveux.`
          : vix <= 15
            ? `Le VIX à ${vix.toFixed(0)} traduit un marché serein.`
            : `Volatilité attendue modérée (VIX ${vix.toFixed(0)}).`,
      );
    }
    const gold = q.get('GC=F')?.change;
    if (gold > 0.03) parts.push('L’or progresse nettement : recherche de valeurs refuges.');
    const oil = q.get('BZ=F')?.change;
    if (Math.abs(oil) > 0.06) parts.push(`Le pétrole ${oil > 0 ? 'bondit' : 'décroche'} (${pct(oil, 1)}).`);
    return parts.join(' ');
  }
  function movers(q) {
    const all = stocks
      .map((a) => ({ a, q: q.get(a.id) }))
      .filter((x) => x.q)
      .sort((x, y) => y.q.change - x.q.change);
    return all.length > 7 ? [...all.slice(0, 4), ...all.slice(-3)] : all;
  }
  const arc = (score) => {
    const a = Math.PI * (1 - score / 100);
    return `${100 + 80 * Math.cos(a)},${100 - 80 * Math.sin(a)}`;
  };
  const tone = (s) => (s >= 55 ? 'var(--up)' : s >= 45 ? 'var(--warn)' : 'var(--down)');
</script>

<h1 class="title">Vue d’ensemble <span class="muted" style="font-weight:500">· {regionLabel}</span></h1>

{#await load}
  <div class="skel" style="height:150px"></div>
  <div class="grid">{#each Array(6) as _}<div class="skel" style="height:96px"></div>{/each}</div>
  <div class="skel" style="height:240px"></div>
{:then q}
  {@const p = pulse(indices.map((a) => q.get(a.id)?.change), q.get('^VIX')?.price)}
  {#if p}
    <div class="card pulse">
      <div class="gauge">
        <svg viewBox="0 0 200 112" width="200">
          <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--surface-2)" stroke-width="14" stroke-linecap="round" />
          <path d="M20,100 A80,80 0 0 1 {arc(p.score)}" fill="none" stroke={tone(p.score)} stroke-width="14" stroke-linecap="round" />
        </svg>
        <div class="lab"><b class="num">{p.score.toFixed(0)}</b><span class="muted small">sur 100</span></div>
      </div>
      <div>
        <div class="muted small" style="font-weight:600">POULS DU MARCHÉ</div>
        <div style="font-size:21px;font-weight:740;color:{tone(p.score)}">{p.label}</div>
        <p style="margin-top:6px">{summary(p, q)}</p>
        <p class="muted small" style="margin-top:6px">
          Synthèse calculée à partir de la part d’indices en hausse, de leur variation moyenne et du VIX.
        </p>
      </div>
    </div>
  {:else}
    <div class="card error">Les cotations ne répondent pas. Vérifiez la connexion puis actualisez.</div>
  {/if}

  <div>
    <div class="section-title"><h2>Facteurs clés</h2></div>
    <div class="grid">
      {#each MACRO as a (a.id)}
        {@const x = q.get(a.id)}
        {#if x}
          <button class="card tile" onclick={() => openDetail(a)}>
            <span class="k">{a.name}</span>
            <span class="v num">{price(x.price, x.cur)}</span>
            <span style="display:flex;justify-content:space-between;align-items:center">
              <span class="badge {dir(x.change)} num">{pct(x.change)}</span>
              <Spark values={x.spark} width={60} height={24} />
            </span>
          </button>
        {/if}
      {/each}
      {#await crypto then list}
        {@const b = list.find((c) => c.id === 'bitcoin')}
        {#if b}
          <button class="card tile" onclick={() => openDetail(b)}>
            <span class="k">Bitcoin</span>
            <span class="v num">{price(b.price, b.cur)}</span>
            <span style="display:flex;justify-content:space-between;align-items:center">
              <span class="badge {dir(b.ch['1d'])} num">{pct(b.ch['1d'])}</span>
              <span class="muted small">24 h</span>
            </span>
          </button>
        {/if}
      {/await}
    </div>
  </div>

  {#if favs.length}
    <div>
      <div class="section-title"><h2>Mes favoris</h2></div>
      <div class="card flush">
        {#each favs as a (a.id)}
          {@const x = q.get(a.id)}
          {#if x}
            <Row
              name={a.name}
              sub={a.s}
              avatar={a.s.replace('^', '').slice(0, 3)}
              priceText={price(x.price, x.cur)}
              change={x.change}
              spark={x.spark}
              onclick={() => openDetail(a)}
            />
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <div class="two">
    <div>
      <div class="section-title"><h2>Indices</h2><button onclick={() => (ui.tab = 'stocks')}>Tout voir</button></div>
      <div class="card flush">
        {#each indices.slice(0, 7) as a (a.id)}
          {@const x = q.get(a.id)}
          {#if x}
            <Row
              name={a.name}
              sub="Indice · points"
              avatar={a.s.replace('^', '').slice(0, 3)}
              priceText={price(x.price)}
              change={x.change}
              spark={x.spark}
              onclick={() => openDetail(a)}
            />
          {/if}
        {/each}
      </div>
    </div>
    <div>
      <div class="section-title"><h2>Plus fortes variations</h2></div>
      <div class="card flush">
        {#each movers(q) as m (m.a.id)}
          <Row
            name={m.a.name}
            sub={m.a.sector}
            avatar={m.a.s.slice(0, 3)}
            priceText={price(m.q.price, m.q.cur)}
            change={m.q.change}
            spark={m.q.spark}
            onclick={() => openDetail(m.a)}
          />
        {/each}
      </div>
    </div>
  </div>
{:catch}
  <div class="card error">Impossible de charger les cotations. Vérifiez la connexion.</div>
{/await}

<div>
  <div class="section-title"><h2>À la une</h2><button onclick={() => (ui.tab = 'news')}>Toute l’actualité</button></div>
  {#await news}
    <div class="skel" style="height:120px"></div>
  {:then items}
    <div class="news">
      {#each items.filter((n) => n.themes.length).slice(0, 4) as n (n.link)}
        <a class="card article" href={n.link} target="_blank" rel="noopener noreferrer">
          <h3>{n.title}</h3>
          <div class="meta"><b>{n.source}</b> · {ago(n.at)}</div>
        </a>
      {:else}
        <div class="card empty">Actualités indisponibles pour le moment.</div>
      {/each}
    </div>
  {/await}
</div>
