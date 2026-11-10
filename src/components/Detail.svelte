<script>
  import Chart from './Chart.svelte';
  import Chips from './Chips.svelte';
  import Icon from './Icon.svelte';
  import { settings, closeDetail, toggleFav } from '../lib/state.svelte.js';
  import { loadDetail, detailRanges } from '../lib/data.js';
  import { rsi, annVol, maxDrawdown, trend, bigMoves, forecast, backtest } from '../lib/analytics.js';
  import { causes } from '../lib/news.js';
  import { price, pct, dir, date } from '../lib/format.js';

  // La fiche est recréée à chaque changement d'actif ({#key} dans App) : `asset` est fixe ici.
  /* svelte-ignore state_referenced_locally */
  let { asset } = $props();

  const housing = asset.kind === 'housing';
  const ranges = detailRanges(asset);
  let range = $state(housing ? 'h10' : ranges.some((r) => r.id === settings.period) ? settings.period : '1y');

  const HORIZONS = housing
    ? [{ id: 2, label: '6 mois' }, { id: 4, label: '1 an' }, { id: 8, label: '2 ans' }]
    : asset.kind === 'crypto'
      ? [{ id: 7, label: '7 jours' }, { id: 30, label: '30 jours' }, { id: 90, label: '90 jours' }]
      : [{ id: 5, label: '1 semaine' }, { id: 21, label: '1 mois' }, { id: 63, label: '3 mois' }];
  let horizon = $state(HORIZONS[1].id);
  let showFc = $state(true);

  let data = $state(null);
  let error = $state('');
  let loading = $state(true);

  $effect(() => {
    const r = range, c = settings.currency;
    let stale = false;
    loading = true;
    error = '';
    loadDetail(asset, r, c)
      .then((d) => { if (!stale) data = d; })
      .catch((e) => { if (!stale) error = e.message.includes('429') ? 'Trop de requêtes vers la source de données. Réessayez dans une minute.' : 'Impossible de charger les données. Vérifiez la connexion.'; })
      .finally(() => { if (!stale) loading = false; });
    return () => (stale = true);
  });

  const vals = $derived(data ? data.points.map((p) => p.v) : []);
  const mv = $derived(data ? data.model.map((p) => p.v) : []);
  const last = $derived(vals[vals.length - 1]);
  const change = $derived(vals.length ? last / (range === '1d' && data.prev ? data.prev : vals[0]) - 1 : 0);
  const cur = $derived(data?.cur ?? null);
  const fmt = (v) => price(v, cur);

  const ind = $derived.by(() => {
    if (mv.length < 20) return null;
    const year = mv.slice(-data.ppy);
    return {
      rsi: rsi(mv),
      vol: annVol(mv, data.ppy, housing ? 12 : 30),
      dd: maxDrawdown(vals),
      trend: trend(mv),
      hi: Math.max(...year),
      lo: Math.min(...year),
    };
  });

  const block = housing ? 2 : 5;
  const fc = $derived(mv.length ? forecast(mv, { horizon, block }) : null);
  const bt = $derived(mv.length ? backtest(mv, { horizon, block }) : null);
  const hLabel = $derived(HORIZONS.find((h) => h.id === horizon).label);

  // Dates futures de la projection (jours ouvrés pour les marchés cotés)
  const fcTimes = $derived.by(() => {
    if (!data || !fc) return [];
    const out = [];
    let d = new Date(data.model[data.model.length - 1].t * 1000);
    for (let k = 0; k < horizon; k++) {
      if (housing) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1));
      else {
        d = new Date(d.getTime() + 86400000);
        if (data.ppy === 252) while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + 86400000);
      }
      out.push(Math.floor(d.getTime() / 1000));
    }
    return out;
  });
  const overlay = $derived(showFc && fc && data && !data.intraday ? { ...fc, times: fcTimes } : null);

  // Détection sur l'historique complet (la volatilité de référence a besoin de recul),
  // puis on ne garde que les mouvements visibles sur la période affichée.
  const moves = $derived.by(() => {
    if (!data || data.intraday || housing) return [];
    if (range === '5y') return bigMoves(data.points);
    const from = data.points[0].t;
    return bigMoves(data.model, { max: 400 }).filter((m) => m.t >= from).sort((a, b) => b.score - a.score).slice(0, 6).sort((a, b) => a.t - b.t);
  });
  let found = $state({});
  const query =
    asset.kind === 'crypto' ? `${asset.name} crypto` : `${asset.name.split(/ [—(]/)[0]} ${asset.kind === 'macro' ? '' : 'bourse'}`.trim();
  async function explain(t) {
    found[t] = { loading: true };
    try {
      found[t] = { items: await causes(query, t) };
    } catch {
      found[t] = { error: true };
    }
  }

  const rsiText = (v) => (v >= 70 ? 'suracheté' : v <= 30 ? 'survendu' : 'zone neutre');
  const calib = (c) => (Math.abs(c - 0.8) <= 0.1 ? 'bien calibré' : c < 0.7 ? 'intervalle trop étroit par le passé' : 'intervalle plutôt prudent');
  const fav = $derived(settings.favorites.includes(asset.id));
</script>

<div class="sheet">
  <div class="sheet-head">
    <button class="icon-btn" onclick={closeDetail} aria-label="Retour"><Icon name="back" /></button>
    <div class="name">{asset.name}</div>
    {#if !housing}
      <button class="icon-btn" class:on={fav} onclick={() => toggleFav(asset.id)} aria-label="Favori">
        <Icon name={fav ? 'star-fill' : 'star'} />
      </button>
    {/if}
  </div>

  <div class="page">
    {#if error && !data}
      <div class="card error">{error}</div>
    {:else if !data}
      <div class="skel" style="height:90px"></div>
      <div class="skel" style="height:320px"></div>
    {:else}
      <div>
        <div class="muted small">
          {housing ? 'Prix des logements · indice BIS, base 100 en 2010' : asset.kind === 'crypto' ? `${asset.s} · cryptomonnaie` : asset.s}
          {#if asset.sector} · {asset.sector}{/if}
        </div>
        <div class="big num">{fmt(last)}</div>
        <span class="badge {dir(change)} num">{pct(change)}</span>
        <span class="muted small"> sur la période affichée</span>
        {#if housing}<div class="muted small">Dernier trimestre publié : {date(data.points[data.points.length - 1].t)}</div>{/if}
        {#if asset.hint}<p class="muted small" style="margin-top:6px">{asset.hint}</p>{/if}
      </div>

      <div class="toolbar">
        <Chips options={ranges} bind:value={range} label="Période" />
        <span class="spacer"></span>
        {#if !data.intraday && fc}
          <button class="chip" class:on={showFc} onclick={() => (showFc = !showFc)}>Projection</button>
        {/if}
      </div>

      <div class="card" style="padding:10px 6px 6px; opacity:{loading ? 0.5 : 1}">
        <Chart points={data.points} fc={overlay} markers={moves} intraday={data.intraday} rising={change >= 0} />
        <div class="legend" style="padding:6px 10px 4px">
          <span><i style="color:var(--{change >= 0 ? 'up' : 'down'})"></i>Cours</span>
          {#if overlay}
            <span><i class="dash" style="color:var(--accent)"></i>Scénario médian</span>
            <span><i class="dash" style="color:var(--muted)"></i>Intervalle 80 %</span>
          {/if}
          {#if moves.length}<span>● Mouvements marquants</span>{/if}
        </div>
      </div>
      {#if error}<div class="note">{error}</div>{/if}

      {#if ind}
        <div class="grid">
          <div class="card tile kpi">
            <span class="k">Tendance</span>
            <span class="v {ind.trend.score >= 2 ? 'up' : ind.trend.score <= -2 ? 'down' : ''}">{ind.trend.label}</span>
            <span class="muted small">cours vs moyennes mobiles</span>
          </div>
          {#if ind.rsi != null}
            <div class="card tile kpi">
              <span class="k">RSI 14</span>
              <span class="v num">{ind.rsi.toFixed(0)}</span>
              <span class="muted small">{rsiText(ind.rsi)}</span>
            </div>
          {/if}
          {#if ind.vol != null}
            <div class="card tile kpi">
              <span class="k">Volatilité annualisée</span>
              <span class="v num">{pct(ind.vol, 1).replace('+', '')}</span>
              <span class="muted small">{housing ? 'sur 3 ans' : 'sur 30 séances'}</span>
            </div>
          {/if}
          <div class="card tile kpi">
            <span class="k">Pire repli</span>
            <span class="v num down">{pct(ind.dd, 1)}</span>
            <span class="muted small">sur la période affichée</span>
          </div>
          <div class="card tile kpi">
            <span class="k">Plus haut / bas 1 an</span>
            <span class="v num" style="font-size:14.5px">{fmt(ind.hi)}</span>
            <span class="muted small num">{fmt(ind.lo)}</span>
          </div>
        </div>
      {/if}

      {#if fc}
        <div class="card">
          <div class="section-title">
            <h2>Projection à {hLabel}</h2>
            <Chips options={HORIZONS} bind:value={horizon} label="Horizon" />
          </div>
          <div class="grid" style="margin-bottom:12px">
            <div class="tile" style="padding:0">
              <span class="k">Scénario médian</span>
              <span class="v num">{fmt(fc.med[horizon - 1])}</span>
              <span class="num {dir(fc.med[horizon - 1] / fc.last - 1)} small">{pct(fc.med[horizon - 1] / fc.last - 1, 1)}</span>
            </div>
            <div class="tile" style="padding:0">
              <span class="k">Fourchette à 80 %</span>
              <span class="v num" style="font-size:15px">{fmt(fc.lo[horizon - 1])} → {fmt(fc.hi[horizon - 1])}</span>
              <span class="num muted small">{pct(fc.lo[horizon - 1] / fc.last - 1, 1)} / {pct(fc.hi[horizon - 1] / fc.last - 1, 1)}</span>
            </div>
            <div class="tile" style="padding:0">
              <span class="k">Probabilité de hausse</span>
              <span class="v num">{(fc.pUp * 100).toFixed(0)} %</span>
              <span class="muted small">part des scénarios simulés</span>
            </div>
          </div>
          <div class="note">
            {#if bt}
              <b>Fiabilité mesurée :</b> rejouée sur {bt.n} dates passées, la fourchette a contenu le cours réel
              <b>{(bt.coverage * 100).toFixed(0)} %</b> du temps (cible : 80 % — {calib(bt.coverage)}). Écart médian-réel moyen :
              {pct(bt.mae, 1).replace('+', '')}.
            {:else}
              Historique trop court pour mesurer la fiabilité à cet horizon.
            {/if}
            <br />
            Méthode : 800 scénarios tirés des variations passées de l’actif, volatilité récente prise en compte. Une projection
            statistique ignore les événements à venir ; ce n’est pas un conseil d’investissement.
          </div>
        </div>
      {/if}

      {#if !housing && !data.intraday}
        <div>
          <div class="section-title"><h2>Mouvements marquants et causes probables</h2></div>
          {#if moves.length}
            <div class="card flush">
              {#each moves as m (m.t)}
                <div class="move">
                  <div class="move-head">
                    <span class="badge {dir(m.pct)} num">{pct(m.pct, 1)}</span>
                    <span style="flex:1">{date(m.t)}</span>
                    {#if !found[m.t]}
                      <button class="link" onclick={() => explain(m.t)}>Voir l’actualité</button>
                    {/if}
                  </div>
                  {#if found[m.t]?.loading}
                    <div class="skel" style="min-height:38px"></div>
                  {:else if found[m.t]?.error}
                    <span class="muted small">Recherche d’actualités indisponible.</span>
                  {:else if found[m.t]?.items}
                    {#each found[m.t].items as it}
                      <a class="headline" href={it.link} target="_blank" rel="noopener noreferrer">
                        {it.title} <span class="muted small">— {it.source}</span>
                      </a>
                    {:else}
                      <span class="muted small">Aucun article trouvé autour de cette date.</span>
                    {/each}
                  {/if}
                </div>
              {/each}
            </div>
            <p class="muted small" style="margin-top:8px">
              Variations inhabituelles au regard de la volatilité du moment. Les articles sont ceux parus autour de la date :
              ils éclairent le contexte sans prouver un lien de cause à effet.
            </p>
          {:else}
            <div class="card empty">Aucune variation inhabituelle sur cette période.</div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
