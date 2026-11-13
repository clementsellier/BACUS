<script>
  import Chart from './Chart.svelte';
  import CandleChart from './CandleChart.svelte';
  import Chips from './Chips.svelte';
  import Icon from './Icon.svelte';
  import { settings, closeDetail, toggleFav, addCompare, addPosition, goTab } from '../lib/state.svelte.js';
  import { FACTORS, COINS } from '../lib/catalog.js';
  import { loadDetail, detailRanges, history, candles as loadCandles, candleAsset, weekly } from '../lib/data.js';
  import { detect, patternStats, recent, PATTERNS, VERDICTS } from '../lib/candles.js';
  import { rsi, annVol, maxDrawdown, trend, bigMoves, forecast, backtest, correlations } from '../lib/analytics.js';
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
    : asset.kind === 'crypto' || asset.kind === 'coin'
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

  // Équivalent utilisable par les outils (comparaison, portefeuille) : tout sauf les indices immobiliers.
  const tool = housing ? null : asset.kind === 'crypto' ? (COINS.find((c) => c.s === `${asset.s}-USD`) ?? null) : asset;
  const holdable = tool && (['stock', 'reit', 'coin'].includes(tool.kind) || (tool.kind === 'macro' && tool.cur));
  let qty = $state('');
  let added = $state(false);
  function compareIt() {
    addCompare(tool);
    goTab('lab', 'compare');
  }
  function hold() {
    const v = parseFloat(String(qty).replace(',', '.'));
    if (!(v > 0)) return;
    addPosition(tool, v);
    qty = '';
    added = true;
  }

  // Sensibilités : avec quels grands facteurs cet actif évolue-t-il, et dans quel sens ?
  let sens = $state(null);
  $effect(() => {
    if (housing || !data) return;
    const model = data.model;
    const fs = FACTORS.filter((f) => f.id !== asset.id && f.id !== tool?.id);
    let stale = false;
    history(fs.map((f) => ({ id: f.id, s: f.id, cur: null, kind: 'index' })), null, '2y')
      .then((h) => {
        if (stale) return;
        const ok = fs.filter((f) => h.has(f.id));
        const cs = correlations(model, ok.map((f) => h.get(f.id).pts));
        sens = ok.map((f, k) => ({ ...f, c: cs[k] })).filter((x) => x.c != null).sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
      })
      .catch(() => {});
    return () => (stale = true);
  });
  // ---------- Bougies (chandeliers japonais) ----------
  const canCandle = !!candleAsset(asset);
  let style = $state(canCandle && settings.chartStyle === 'candle' ? 'candle' : 'line');
  function setStyle(v) {
    style = v;
    settings.chartStyle = v;
  }
  let daily = $state(null); // bougies journalières sur 10 ans : figures et statistiques
  let dailyErr = $state(false);
  $effect(() => {
    if (!canCandle) return;
    const c = settings.currency;
    let stale = false;
    dailyErr = false;
    loadCandles(asset, c)
      .then((d) => { if (!stale) daily = d; })
      .catch(() => { if (!stale) dailyErr = true; });
    return () => (stale = true);
  });
  let intra = $state(null);
  let intraErr = $state(false);
  $effect(() => {
    const r = range, c = settings.currency;
    intra = null;
    intraErr = false;
    if (!canCandle || style !== 'candle' || (r !== '1d' && r !== '5d')) return;
    let stale = false;
    loadCandles(asset, c, r)
      .then((d) => { if (!stale) intra = d; })
      .catch(() => { if (!stale) intraErr = true; });
    return () => (stale = true);
  });

  const isIntra = $derived(range === '1d' || range === '5d');
  const shownCandles = $derived.by(() => {
    if (style !== 'candle') return null;
    if (isIntra) return intra?.candles ?? null;
    if (!daily) return null;
    const cs = daily.candles;
    const end = cs[cs.length - 1].t;
    if (range === '5y') return weekly(cs.filter((k) => k.t >= end - 5 * 365.25 * 86400));
    const span = ({ '1mo': 31, '3mo': 92, '1y': 366 }[range] ?? 366) * 86400;
    return cs.filter((k) => k.t >= end - span);
  });
  const candleFail = $derived(style === 'candle' && (isIntra ? intraErr : dailyErr));
  const candleWait = $derived(style === 'candle' && !shownCandles && !candleFail);

  const hits = $derived(daily ? detect(daily.candles) : []);
  const marks = $derived.by(() => {
    if (!shownCandles || isIntra || range === '5y') return [];
    const from = shownCandles[0].t;
    return hits
      .filter((x) => x.t >= from && PATTERNS[x.id].dir !== 0)
      .map((x) => ({ t: x.t, dir: PATTERNS[x.id].dir, label: range === '1mo' && window.innerWidth >= 700 ? PATTERNS[x.id].label : '' }));
  });
  const daysWord = asset.kind === 'crypto' || asset.kind === 'coin';
  const CH = daysWord
    ? [{ id: 5, label: '5 jours' }, { id: 10, label: '10 jours' }, { id: 20, label: '20 jours' }]
    : [{ id: 5, label: '1 semaine' }, { id: 10, label: '2 semaines' }, { id: 20, label: '1 mois' }];
  let ch = $state(5);
  const chLong = $derived(CH.find((x) => x.id === ch).label);
  const pstats = $derived(daily && daily.candles.length > 60 ? patternStats(daily.candles, hits, ch) : null);
  const latest = $derived(daily ? recent(daily.candles, hits, 10).slice(0, 4) : []);
  const years = $derived(daily ? Math.max(1, Math.round((daily.candles[daily.candles.length - 1].t - daily.candles[0].t) / (365.25 * 86400))) : 0);
  const reliability = $derived(pstats ? Object.entries(pstats.stats).filter(([, x]) => x.n > 0).sort((a, b) => b[1].n - a[1].n) : []);
  const pp = (x) => (x * 100).toFixed(0) + ' %';
  const gap = (x) => {
    const v = Math.round(x * 100);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' pt';
  };
  const arrow = (d) => (d > 0 ? '▲' : d < 0 ? '▼' : '●');
  const arrowCls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'muted');
  const verdictTag = (v) => (VERDICTS[v].cls === 'up' ? 'new' : VERDICTS[v].cls === 'down' ? 'hot' : '');
  function sessionsAgo(i) {
    const k = daily.candles.length - 1 - i;
    if (k === 0) return daysWord ? 'dernier jour' : 'dernière séance';
    if (k === 1) return daysWord ? 'la veille' : 'séance précédente';
    return `il y a ${k} ${daysWord ? 'jours' : 'séances'}`;
  }
  const shortName = asset.name.split(/ [—(]/)[0];

  const strength = (c) => (Math.abs(c) >= 0.6 ? 'fortement' : Math.abs(c) >= 0.3 ? 'modérément' : 'faiblement');
</script>

<div class="sheet">
  <div class="sheet-head">
    <button class="icon-btn" onclick={closeDetail} aria-label="Retour"><Icon name="back" /></button>
    <div class="name">{asset.name}</div>
    {#if !housing}
      <button class="icon-btn" class:on={fav} onclick={() => toggleFav(asset)} aria-label="Favori">
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

      {#if tool}
        <div class="toolbar">
          <button class="chip" onclick={compareIt}>Comparer à d’autres actifs</button>
          {#if holdable}
            <input class="input" style="max-width:150px;flex:0 1 150px" inputmode="decimal" placeholder="Quantité détenue" bind:value={qty} />
            <button class="chip" class:on={added} onclick={hold}>{added ? 'Ajouté au portefeuille ✓' : '+ Portefeuille'}</button>
          {/if}
        </div>
      {/if}

      <div class="toolbar">
        <Chips options={ranges} bind:value={range} label="Période" />
        <span class="spacer"></span>
        {#if canCandle}
          <div class="seg" role="group" aria-label="Type de graphique">
            <button class:on={style === 'line'} onclick={() => setStyle('line')}>Courbe</button>
            <button class:on={style === 'candle'} onclick={() => setStyle('candle')}>Bougies</button>
          </div>
        {/if}
        {#if !data.intraday && fc}
          <button class="chip" class:on={showFc} onclick={() => (showFc = !showFc)}>Projection</button>
        {/if}
      </div>

      <div class="card" style="padding:10px 6px 6px; opacity:{loading ? 0.5 : 1}">
        {#if style === 'candle' && shownCandles}
          <CandleChart candles={shownCandles} {marks} fc={range === '1mo' ? null : overlay} intraday={isIntra} />
          <div class="legend" style="padding:6px 10px 4px">
            <span><i style="color:var(--up)"></i>Clôture au-dessus de l’ouverture</span>
            <span><i style="color:var(--down)"></i>En dessous</span>
            {#if marks.length}<span><b class="up">▲</b> / <b class="down">▼</b> Figure de hausse / de baisse</span>{/if}
            {#if range === '5y'}<span>Une bougie par semaine</span>{/if}
            {#if overlay && range !== '1mo'}<span><i class="dash" style="color:var(--accent)"></i>Scénario médian</span>{/if}
          </div>
        {:else if candleWait}
          <div class="skel" style="height:300px"></div>
        {:else}
          <Chart points={data.points} fc={overlay} markers={moves} intraday={data.intraday} rising={change >= 0} />
          <div class="legend" style="padding:6px 10px 4px">
            <span><i style="color:var(--{change >= 0 ? 'up' : 'down'})"></i>Cours</span>
            {#if overlay}
              <span><i class="dash" style="color:var(--accent)"></i>Scénario médian</span>
              <span><i class="dash" style="color:var(--muted)"></i>Intervalle 80 %</span>
            {/if}
            {#if moves.length}<span>● Mouvements marquants</span>{/if}
            {#if candleFail}<span>Bougies indisponibles pour cet actif : courbe affichée.</span>{/if}
          </div>
        {/if}
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

      {#if canCandle && pstats}
        <div class="card">
          <div class="section-title">
            <h2>Lecture des bougies</h2>
            <Chips options={CH} bind:value={ch} label="Horizon" />
          </div>
          {#each latest as x (x.i + x.id)}
            {@const P = PATTERNS[x.id]}
            {@const st = pstats.stats[x.id]}
            <div class="figure">
              <div class="figure-head">
                <b class={arrowCls(P.dir)}>{arrow(P.dir)}</b>
                <b>{P.label}</b>
                <span class="muted small">{sessionsAgo(x.i)} · {date(x.t)}</span>
              </div>
              <p class="muted small">{P.text}</p>
              {#if st.n}
                <p class="small">
                  Sur {years} ans de {shortName}, cette figure est apparue <b>{st.n} fois</b>. {chLong} plus tard, le cours
                  était plus haut dans <b>{pp(st.pUp)}</b> des cas, contre {pp(pstats.base.pUp)} en temps normal ;
                  variation moyenne <b class={dir(st.mean)}>{pct(st.mean, 1)}</b>.
                  <span class="tag {verdictTag(st.verdict)}">{VERDICTS[st.verdict].label}</span>
                </p>
              {/if}
            </div>
          {:else}
            <p class="muted small">Aucune figure classique sur les 10 {daysWord ? 'derniers jours' : 'dernières séances'}.</p>
          {/each}

          {#if reliability.length}
            <details class="reliab">
              <summary>Fiabilité de chaque figure sur {shortName} ({years} ans, à {chLong})</summary>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr><th>Figure</th><th>Fois</th><th>Hausse ensuite</th><th>Écart à la normale</th><th>Moyenne</th><th>Verdict</th></tr>
                  </thead>
                  <tbody>
                    {#each reliability as [id, st] (id)}
                      <tr>
                        <td><b class={arrowCls(PATTERNS[id].dir)}>{arrow(PATTERNS[id].dir)}</b> {PATTERNS[id].label}</td>
                        <td class="num">{st.n}</td>
                        <td class="num">{pp(st.pUp)}</td>
                        <td class="num">{gap(st.pUp - pstats.base.pUp)}</td>
                        <td class="num {dir(st.mean)}">{pct(st.mean, 1)}</td>
                        <td class={VERDICTS[st.verdict].cls}>{VERDICTS[st.verdict].label}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </details>
          {/if}
          <p class="muted small" style="margin-top:8px">
            Bougies journalières sur {years} ans ({daily.candles.length} {daysWord ? 'jours' : 'séances'}). « En temps normal » :
            part de toutes les {daysWord ? 'journées' : 'séances'} suivies d’une hausse à {chLong} ({pp(pstats.base.pUp)}).
            Une figure n’est qu’un indice : sur les grands marchés, beaucoup ne font guère mieux que le hasard, d’où l’intérêt
            de vérifier actif par actif. Ce n’est pas un conseil d’investissement.
          </p>
        </div>
      {/if}

      {#if sens?.length}
        {@const top = sens[0]}
        {@const opp = sens.find((x) => x.c <= -0.2)}
        <div class="card">
          <div class="section-title"><h2>À quoi cet actif est-il sensible ?</h2></div>
          {#each sens as x (x.id)}
            <div class="div-row">
              <span class="div-label">{x.label}{#if x.hint}<span class="muted small" style="margin-left:5px">· {x.hint}</span>{/if}</span>
              <span class="div-track">
                <span class="div-fill" style="background:var(--{x.c >= 0 ? 'c1' : 'c2'});width:{Math.abs(x.c) * 50}%;{x.c >= 0 ? 'left:50%' : 'right:50%'}"></span>
              </span>
              <b class="num">{x.c > 0 ? '+' : x.c < 0 ? '−' : ''}{Math.abs(x.c).toFixed(2).replace('.', ',')}</b>
            </div>
          {/each}
          <p class="muted small" style="margin-top:8px">
            {asset.name.split(/ [—(]/)[0]} évolue {strength(top.c)} {top.c >= 0 ? 'dans le même sens que' : 'à l’inverse de'}
            « {top.label.toLowerCase()} »{#if opp && opp !== top}, et plutôt à l’inverse de « {opp.label.toLowerCase()} »{/if}.
            Corrélation des variations hebdomadaires sur 2 ans, de −1 (opposé) à +1 (identique), mesurée dans votre devise.
            Un lien statistique passé n’est pas une garantie.
          </p>
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
