<script>
  import MultiChart from '../components/MultiChart.svelte';
  import { settings, ui, findAsset, addCompare, openDetail } from '../lib/state.svelte.js';
  import { INDICES, STOCKS, REITS, COINS, MACRO, SHOCK_SET, CLASSES, PERIODS, inRegion } from '../lib/catalog.js';
  import { history, candlesMany } from '../lib/data.js';
  import { detect, pooledStats, PATTERNS, VERDICTS } from '../lib/candles.js';
  import { align, corrMatrix, logReturns, maxDrawdown, bigMoves, reaction, dayOf } from '../lib/analytics.js';
  import { causes } from '../lib/news.js';
  import { pct, dir, date } from '../lib/format.js';

  const std = (a) => {
    const m = a.reduce((s, x) => s + x, 0) / a.length;
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  };
  const short = (n) => n.split(/ [—(]/)[0];

  // ------------------------------------------------------------ Comparer
  const SPAN = { '1d': 31, '5d': 31, '1mo': 31, '3mo': 92, '1y': 366, '5y': 731 };
  const cmpAssets = $derived(settings.compare.map(findAsset).filter(Boolean));
  const cmpLoad = $derived(ui.lab === 'compare' && cmpAssets.length ? history(cmpAssets, settings.currency, '2y') : null);
  const cmpLabel = $derived(
    { '1d': 'sur 1 mois', '5d': 'sur 1 mois', '5y': 'sur 2 ans' }[settings.period] ?? PERIODS.find((p) => p.id === settings.period).long,
  );

  function compare(hist) {
    const rows = cmpAssets.filter((a) => hist.has(a.id)).map((a, k) => ({ a, color: `--c${k + 1}`, pts: hist.get(a.id).pts }));
    if (!rows.length) return null;
    const { days, cols } = align(rows.map((r) => r.pts));
    const from = days.findIndex((d) => d >= days[days.length - 1] - SPAN[settings.period]);
    const lines = rows.map((r, k) => {
      const win = cols[k].slice(from);
      const own = r.pts.filter((p) => dayOf(p.t) >= days[from]).map((p) => p.v);
      const rets = logReturns(own);
      return {
        ...r,
        label: short(r.a.name),
        points: win.map((v, i) => ({ t: days[from + i] * 86400, v: (v / win[0]) * 100 })),
        perf: win[win.length - 1] / win[0] - 1,
        vol: rets.length > 5 ? std(rets) * Math.sqrt(r.a.kind === 'coin' ? 365 : 252) : null,
        dd: maxDrawdown(win),
      };
    });
    return { lines, matrix: rows.length > 1 ? corrMatrix(rows.map((r) => r.pts)) : null };
  }
  const cell = (c) =>
    c == null ? '' : `background:color-mix(in srgb, var(${c >= 0 ? '--warn' : '--accent'}) ${Math.round(Math.abs(c) * 55)}%, transparent)`;
  function addToCompare() {
    ui.picker = { title: 'Ajouter à la comparaison…', onpick: addCompare };
  }

  // ------------------------------------------------------------ Onde de choc
  const HORIZONS = [{ id: 'd0', label: 'Le jour même' }, { id: 'd5', label: 'Après 1 semaine' }, { id: 'd20', label: 'Après 1 mois' }];
  let horizon = $state('d0');
  let shockDay = $state(null); // jour (nombre de jours depuis 1970)
  let headlines = $state({});
  const shockLoad = $derived(ui.lab === 'shock' ? history(SHOCK_SET, null, '5y') : null);

  const shockDates = (hist) =>
    bigMoves(hist.get('^GSPC')?.pts ?? [], { z: 2.5, max: 10 }).sort((a, b) => b.t - a.t);
  function selectDay(day) {
    shockDay = day;
    if (headlines[day]) return;
    headlines[day] = { loading: true };
    causes('bourse marchés', day * 86400 + 43200)
      .then((items) => (headlines[day] = { items }))
      .catch(() => (headlines[day] = { error: true }));
  }
  function shock(hist, day) {
    const rows = SHOCK_SET.filter((a) => hist.has(a.id))
      .map((a) => ({ a, r: reaction(hist.get(a.id).pts, day, a.unit) }))
      .filter((x) => x.r && x.r[horizon] != null);
    const max = {};
    for (const x of rows) max[x.a.unit] = Math.max(max[x.a.unit] || 0, Math.abs(x.r[horizon]));
    const groups = [...new Set(rows.map((x) => x.a.group))].map((g) => ({ g, rows: rows.filter((x) => x.a.group === g) }));
    const v = (id) => rows.find((x) => x.a.id === id)?.r[horizon];
    const sp = v('^GSPC'), gold = v('GC=F'), vix = v('^VIX'), usd = v('DX-Y.NYB');
    let read = 'Réaction contrastée selon les marchés.';
    if (sp < -0.01 && gold > 0 && vix > 0) read = 'Fuite vers les valeurs refuges : les actions reculent, l’or et la nervosité montent.';
    else if (sp < -0.01 && gold <= 0 && usd > 0) read = 'Vente généralisée : même l’or recule, seul le dollar est recherché.';
    else if (sp < -0.01) read = 'Les actions décrochent sans report net vers les refuges habituels.';
    else if (sp > 0.01 && vix < 0) read = 'Soulagement : les actions rebondissent et la nervosité retombe.';
    else if (sp > 0.01) read = 'Les actions montent, mais la nervosité ne retombe pas.';
    return { groups, max, read, n: rows.length };
  }
  const fmt = (v, unit) =>
    unit === 'pct' ? pct(v, 1) : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(unit === 'bp' ? 0 : 1).replace('.', ',')} ${unit === 'bp' ? 'pb' : 'pts'}`;
  const iso = (day) => new Date(day * 86400000).toISOString().slice(0, 10);

  // ------------------------------------------------------------ Risque / rendement
  const mapAssets = $derived([
    ...inRegion(INDICES, settings.region), ...inRegion(STOCKS, settings.region), ...inRegion(REITS, settings.region),
    ...COINS, ...MACRO.filter((m) => m.cur),
  ]);
  const mapLoad = $derived(ui.lab === 'map' ? history(mapAssets, settings.currency, '1y') : null);
  let picked = $state(null);
  const W = 640, H = 400, PAD = { l: 46, r: 14, t: 14, b: 34 };
  function scatter(hist) {
    const dots = mapAssets.filter((a) => hist.has(a.id)).map((a) => {
      const v = hist.get(a.id).pts.map((p) => p.v);
      return { a, perf: v[v.length - 1] / v[0] - 1, vol: std(logReturns(v)) * Math.sqrt(a.kind === 'coin' ? 365 : 252) };
    });
    if (!dots.length) return null;
    const xMax = Math.max(...dots.map((d) => d.vol)) * 1.05;
    const yMin = Math.min(0, ...dots.map((d) => d.perf)) * 1.1, yMax = Math.max(0, ...dots.map((d) => d.perf)) * 1.1;
    const x = (v) => PAD.l + (v / xMax) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
    const ticks = (lo, hi, n) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
    const byPerf = [...dots].sort((p, q) => q.perf - p.perf);
    const labelled = new Set([...byPerf.slice(0, 3), ...byPerf.slice(-2), [...dots].sort((p, q) => q.vol - p.vol)[0]].map((d) => d.a.id));
    return { dots, x, y, xt: ticks(0, xMax, 4), yt: ticks(yMin, yMax, 4), labelled };
  }

  // ------------------------------------------------------------ Bougies : scanner de figures
  const SCAN_H = [{ id: 5, label: '1 semaine' }, { id: 10, label: '2 semaines' }, { id: 20, label: '1 mois' }];
  let scanH = $state(5);
  let scanFilter = $state('all');
  const scanAssets = $derived([
    ...inRegion(INDICES, settings.region), ...inRegion(STOCKS, settings.region), ...COINS,
    ...MACRO.filter((m) => m.id !== '^VIX'),
  ]);
  const scanLoad = $derived(
    ui.lab === 'candles'
      ? candlesMany(scanAssets).then((m) =>
          scanAssets.filter((a) => m.get(a.id)?.length > 60).map((a) => {
            const cs = m.get(a.id);
            return { a, cs, hits: detect(cs) };
          }),
        )
      : null,
  );
  const today = Math.floor(Date.now() / 86400000);
  /** Figures apparues sur les 3 dernières bougies de chaque actif. */
  function signals(series, pooled) {
    const rows = [];
    for (const s of series) {
      const n = s.cs.length;
      for (const x of s.hits) {
        if (x.i < n - 3) continue;
        const st = pooled.stats[x.id];
        rows.push({ ...s, x, age: n - 1 - x.i, live: x.i === n - 1 && Math.floor(s.cs[n - 1].t / 86400) === today, st, dir: PATTERNS[x.id].dir });
      }
    }
    const strength = (r) => (r.st.z == null ? 0 : (r.dir || 1) * r.st.z);
    return rows
      .filter((r) => scanFilter === 'all' || (scanFilter === 'up' ? r.dir > 0 : r.dir < 0))
      .sort((p, q) => p.age - q.age || strength(q) - strength(p));
  }
  const pp = (x) => (x * 100).toFixed(0) + ' %';
  const gap = (x) => {
    const v = Math.round(x * 100);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' pt';
  };
  const arrow = (d) => (d > 0 ? '▲' : d < 0 ? '▼' : '●');
  const arrowCls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'muted');
  const verdictTag = (v) => (VERDICTS[v].cls === 'up' ? 'new' : VERDICTS[v].cls === 'down' ? 'hot' : '');
  const ageText = (r) => (r.age === 0 ? (r.live ? 'séance en cours' : 'dernière séance') : r.age === 1 ? 'séance précédente' : 'il y a 2 séances');
</script>

<h1 class="title">Analyse</h1>

<div class="seg" style="align-self:flex-start">
  <button class:on={ui.lab === 'compare'} onclick={() => (ui.lab = 'compare')}>Comparer</button>
  <button class:on={ui.lab === 'shock'} onclick={() => (ui.lab = 'shock')}>Onde de choc</button>
  <button class:on={ui.lab === 'map'} onclick={() => (ui.lab = 'map')}>Risque / rendement</button>
  <button class:on={ui.lab === 'candles'} onclick={() => (ui.lab = 'candles')}>Bougies</button>
</div>

{#if ui.lab === 'compare'}
  <p class="muted">Mettez côte à côte des actifs de toute nature, ramenés à une base 100 dans votre devise, et vérifiez s’ils se diversifient vraiment.</p>
  <div class="filters" style="padding:0">
    {#each cmpAssets as a, k (a.id)}
      <button class="chip on" style="color:var(--c{k + 1});background:color-mix(in srgb, var(--c{k + 1}) 14%, transparent)"
        onclick={() => (settings.compare = settings.compare.filter((id) => id !== a.id))} aria-label={`Retirer ${a.name}`}>
        {short(a.name)} ✕
      </button>
    {/each}
    {#if cmpAssets.length < 5}<button class="chip" onclick={addToCompare}>+ Ajouter</button>{/if}
  </div>

  {#if !cmpAssets.length}
    <div class="card empty">Ajoutez au moins un actif à comparer.</div>
  {:else}
    {#await cmpLoad}
      <div class="skel" style="height:340px"></div>
    {:then hist}
      {@const r = hist && compare(hist)}
      {#if r}
        <div class="card" style="padding:10px 6px 6px">
          <MultiChart lines={r.lines} />
        </div>
        <div class="card flush table-wrap">
          <table class="table num">
            <thead><tr><th>Base 100 {cmpLabel}</th><th>Performance</th><th>Volatilité</th><th>Pire repli</th></tr></thead>
            <tbody>
              {#each r.lines as l}
                <tr>
                  <td><span class="dot" style="background:var({l.color})"></span> {l.label}</td>
                  <td class={dir(l.perf)}><b>{pct(l.perf, 1)}</b></td>
                  <td>{l.vol == null ? '—' : pct(l.vol, 0).replace('+', '')}</td>
                  <td class="down">{pct(l.dd, 1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if r.matrix}
          <div>
            <div class="section-title"><h2>Bougent-ils ensemble ?</h2></div>
            <div class="card flush table-wrap">
              <table class="table matrix num">
                <thead><tr><th></th>{#each r.lines as l}<th>{l.label}</th>{/each}</tr></thead>
                <tbody>
                  {#each r.lines as l, i}
                    <tr>
                      <td>{l.label}</td>
                      {#each r.matrix[i] as c, j}
                        <td style={i === j ? '' : cell(c)}>{i === j ? '—' : c == null ? '?' : c.toFixed(2).replace('.', ',')}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <p class="muted small" style="margin-top:8px">
              Corrélation des variations hebdomadaires sur 2 ans. Proche de 1 : les deux actifs montent et baissent ensemble,
              ils ne se protègent pas. Proche de 0 ou négatif : ils se diversifient.
            </p>
          </div>
        {/if}
      {:else}
        <div class="card error">Données indisponibles pour ces actifs.</div>
      {/if}
    {:catch}
      <div class="card error">Impossible de charger les historiques.</div>
    {/await}
  {/if}
{:else if ui.lab === 'shock'}
  <p class="muted">Choisissez une date marquante et voyez, d’un coup d’œil, comment chaque marché a encaissé l’événement.</p>
  {#await shockLoad}
    <div class="skel" style="height:60px"></div>
    <div class="skel" style="height:420px"></div>
  {:then hist}
    {#if hist}
      {@const dates = shockDates(hist)}
      {@const day = shockDay ?? (dates[0] ? dayOf(dates[0].t) : null)}
      <div class="filters" style="padding:0">
        {#each dates as d (d.t)}
          <button class="chip" class:on={day === dayOf(d.t)} onclick={() => selectDay(dayOf(d.t))}>
            {date(d.t)} <span class={dir(d.pct)}>{pct(d.pct, 1)}</span>
          </button>
        {/each}
      </div>
      <div class="toolbar">
        <label class="muted small" for="shock-date">Autre date :</label>
        <input id="shock-date" class="select" type="date" value={day ? iso(day) : ''} max={iso(Math.floor(Date.now() / 86400000))}
          onchange={(e) => e.target.value && selectDay(Math.floor(Date.parse(e.target.value) / 86400000))} />
        <span class="spacer"></span>
        <div class="seg">
          {#each HORIZONS as h}<button class:on={horizon === h.id} onclick={() => (horizon = h.id)}>{h.label}</button>{/each}
        </div>
      </div>

      {#if day}
        {@const s = shock(hist, day)}
        {#if s.n}
          <div class="card">
            <div class="section-title"><h2>{date(day * 86400)}</h2><span class="muted small">depuis la clôture de la veille</span></div>
            <p style="margin-bottom:12px">{s.read}</p>
            {#each s.groups as g}
              <div class="k muted small" style="font-weight:650;margin:10px 0 4px">{g.g.toUpperCase()}</div>
              {#each g.rows as x (x.a.id)}
                {@const v = x.r[horizon]}
                <div class="div-row">
                  <span class="div-label">{x.a.name}</span>
                  <span class="div-track">
                    <span class="div-fill {dir(v)}" style="width:{(Math.abs(v) / (s.max[x.a.unit] || 1)) * 50}%;{v >= 0 ? 'left:50%' : 'right:50%'}"></span>
                  </span>
                  <b class="num {dir(v)}">{fmt(v, x.a.unit)}</b>
                </div>
              {/each}
            {/each}
            <p class="muted small" style="margin-top:12px">Variations dans la devise de cotation de chaque marché ; pb = point de base (0,01 %). L’Asie et l’Europe ferment
              avant Wall Street : face à un événement survenu en séance américaine, leur réaction n’apparaît que le lendemain.</p>
          </div>

          <div>
            <div class="section-title"><h2>Ce que disait la presse</h2></div>
            {#if !headlines[day]}
              <button class="chip" onclick={() => selectDay(day)}>Chercher les titres autour de cette date</button>
            {:else if headlines[day].loading}
              <div class="skel"></div>
            {:else if headlines[day].error}
              <div class="card empty">Recherche d’actualités indisponible.</div>
            {:else}
              <div class="card" style="display:flex;flex-direction:column;gap:8px">
                {#each headlines[day].items as it}
                  <a class="headline" href={it.link} target="_blank" rel="noopener noreferrer">{it.title} <span class="muted small">— {it.source}</span></a>
                {:else}
                  <span class="muted">Aucun article trouvé autour de cette date.</span>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <div class="card empty">Pas de cotation autour de cette date (week-end, jour férié ou hors de l’historique de 5 ans).</div>
        {/if}
      {/if}
    {/if}
  {:catch}
    <div class="card error">Impossible de charger les historiques.</div>
  {/await}
{:else if ui.lab === 'map'}
  <p class="muted">Chaque point est un actif : plus il est à droite, plus il a secoué ; plus il est haut, plus il a rapporté sur 1 an.</p>
  {#await mapLoad}
    <div class="skel" style="height:400px"></div>
  {:then hist}
    {@const m = hist && scatter(hist)}
    {#if m}
      <div class="card" style="padding:8px">
        <svg viewBox="0 0 {W} {H}" style="width:100%;height:auto;display:block" role="img" aria-label="Carte risque / rendement">
          {#each m.yt as t}
            <line x1={PAD.l} x2={W - PAD.r} y1={m.y(t)} y2={m.y(t)} stroke="var(--border)" />
            <text x={PAD.l - 6} y={m.y(t) + 4} text-anchor="end" class="axis">{(t * 100).toFixed(0)} %</text>
          {/each}
          {#each m.xt as t}
            <text x={m.x(t)} y={H - 12} text-anchor="middle" class="axis">{(t * 100).toFixed(0)} %</text>
          {/each}
          <line x1={PAD.l} x2={W - PAD.r} y1={m.y(0)} y2={m.y(0)} stroke="var(--muted)" stroke-dasharray="3 4" />
          {#each m.dots as d (d.a.id)}
            <circle cx={m.x(d.vol)} cy={m.y(d.perf)} r={picked?.a.id === d.a.id ? 8 : 5.5} fill="var({CLASSES[d.a.kind].color})"
              fill-opacity={picked && picked.a.id !== d.a.id ? 0.35 : 0.85} stroke="var(--surface)" stroke-width="1.5"
              role="button" tabindex="0" aria-label={d.a.name} style="cursor:pointer"
              onclick={() => (picked = d)} onkeydown={(e) => e.key === 'Enter' && (picked = d)} />
            {#if m.labelled.has(d.a.id) || picked?.a.id === d.a.id}
              <text x={m.x(d.vol) + (m.x(d.vol) > W - 120 ? -9 : 9)} y={m.y(d.perf) + 4} text-anchor={m.x(d.vol) > W - 120 ? 'end' : 'start'} class="axis lab">{short(d.a.name)}</text>
            {/if}
          {/each}
          <text x={W - PAD.r} y={H - 26} text-anchor="end" class="axis">volatilité annualisée →</text>
        </svg>
        <div class="legend" style="padding:4px 8px 6px">
          {#each Object.values(CLASSES) as c}<span><span class="dot" style="background:var({c.color})"></span> {c.label}</span>{/each}
        </div>
      </div>
      {#if picked}
        <button class="card row simple" style="border-radius:var(--radius)" onclick={() => openDetail(picked.a)}>
          <span class="avatar">{picked.a.s.replace('^', '').slice(0, 3)}</span>
          <span style="min-width:0">
            <span class="name" style="display:block">{picked.a.name}</span>
            <span class="sub num" style="display:block">
              Performance 1 an {pct(picked.perf, 1)} · volatilité {pct(picked.vol, 0).replace('+', '')} · ouvrir la fiche
            </span>
          </span>
        </button>
      {:else}
        <p class="muted small">Touchez un point pour l’identifier. Le filtre de région s’applique ; performances dans la devise choisie.</p>
      {/if}
    {:else}
      <div class="card error">Données indisponibles.</div>
    {/if}
  {:catch}
    <div class="card error">Impossible de charger les historiques.</div>
  {/await}
{:else if ui.lab === 'candles'}
  <p class="muted">
    Les figures en chandeliers apparues ces 3 dernières séances sur les valeurs suivies, et ce qui a suivi ces mêmes figures
    par le passé sur l’ensemble de ces valeurs.
  </p>
  <div class="toolbar">
    <div class="seg">
      <button class:on={scanFilter === 'all'} onclick={() => (scanFilter = 'all')}>Toutes</button>
      <button class:on={scanFilter === 'up'} onclick={() => (scanFilter = 'up')}>▲ Hausse</button>
      <button class:on={scanFilter === 'down'} onclick={() => (scanFilter = 'down')}>▼ Baisse</button>
    </div>
    <span class="spacer"></span>
    <span class="muted small">Résultat à</span>
    <div class="chips">
      {#each SCAN_H as h}<button class="chip" class:on={scanH === h.id} onclick={() => (scanH = h.id)}>{h.label}</button>{/each}
    </div>
  </div>
  {#await scanLoad}
    <div class="skel" style="height:260px"></div>
    <p class="muted small">Lecture des bougies de {scanAssets.length} valeurs…</p>
  {:then series}
    {#if series?.length}
      {@const pooled = pooledStats(series, scanH)}
      {@const rows = signals(series, pooled)}
      {@const hLabel = SCAN_H.find((h) => h.id === scanH).label}
      <div class="card flush">
        {#each rows as r (r.a.id + r.x.id + r.x.i)}
          <button class="scan-row" onclick={() => openDetail(r.a)}>
            <span style="min-width:0">
              <span class="name">{short(r.a.name)}</span>
              <span class="muted small"> · {ageText(r)}{#if r.live} (provisoire){/if}</span>
              <span style="display:block" class="small">
                <b class={arrowCls(r.dir)}>{arrow(r.dir)} {PATTERNS[r.x.id].label}</b>
                {#if r.st.n}
                  <span class="muted"> — par le passé, hausse à {hLabel} dans {pp(r.st.pUp)} des cas (normale {pp(pooled.base.pUp)}, {r.st.n} exemples)</span>
                {/if}
              </span>
            </span>
            {#if r.st.n}<span class="tag {verdictTag(r.st.verdict)}">{VERDICTS[r.st.verdict].label}</span>{/if}
          </button>
        {:else}
          <div class="empty" style="padding:16px">Aucune figure classique ces 3 dernières séances avec ce filtre.</div>
        {/each}
      </div>

      <details class="reliab card" open>
        <summary>Quelles figures ont vraiment fonctionné ? ({series.length} valeurs, 2 ans, résultat à {hLabel})</summary>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Figure</th><th>Fois</th><th>Hausse ensuite</th><th>Écart à la normale</th><th>Moyenne</th><th>Verdict</th></tr>
            </thead>
            <tbody>
              {#each Object.entries(pooled.stats).filter(([, x]) => x.n > 0).sort((a, b) => PATTERNS[b[0]].dir - PATTERNS[a[0]].dir || b[1].n - a[1].n) as [id, st] (id)}
                <tr>
                  <td><b class={arrowCls(PATTERNS[id].dir)}>{arrow(PATTERNS[id].dir)}</b> {PATTERNS[id].label}</td>
                  <td class="num">{st.n}</td>
                  <td class="num">{pp(st.pUp)}</td>
                  <td class="num">{gap(st.pUp - pooled.base.pUp)}</td>
                  <td class="num {dir(st.mean)}">{pct(st.mean, 1)}</td>
                  <td class={VERDICTS[st.verdict].cls}>{VERDICTS[st.verdict].label}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="muted small" style="margin-top:8px">
          « Normale » : part de toutes les séances suivies d’une hausse à {hLabel} ({pp(pooled.base.pUp)}), sur les mêmes valeurs.
          Une figure n’« a fonctionné » que si l’écart est trop grand pour être dû au hasard. Les bougies de la séance en cours
          sont provisoires : la figure peut disparaître d’ici la clôture. Ce n’est pas un conseil d’investissement.
        </p>
      </details>
    {:else}
      <div class="card error">Bougies indisponibles pour le moment.</div>
    {/if}
  {:catch}
    <div class="card error">Impossible de charger les bougies.</div>
  {/await}
{/if}
