<script>
  import Chips from '../components/Chips.svelte';
  import { settings, findAsset, openDetail } from '../lib/state.svelte.js';
  import { THEME_ASSETS, PERIODS } from '../lib/catalog.js';
  import { quotes } from '../lib/data.js';
  import { NEWS_CATS, THEMES, LANGS, ago, watchHits, latest } from '../lib/news.js';
  import { live, queries } from '../lib/live.svelte.js';
  import { pct, dir } from '../lib/format.js';

  let cat = $state('all');
  let theme = $state('all');
  let lang = $state('all');
  let onlyWatch = $state(false);
  let search = $state('');
  let kw = $state('');
  let limit = $state(30);
  let why = $state({}); // id d'actif → recherche des derniers titres

  const themeLabel = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
  const short = (n) => n.split(/ [—(]/)[0];
  const SUGGEST = ['Fed', 'BCE', 'inflation', 'tarifs', 'OPEP', 'Nvidia', 'Trump', 'Ukraine', 'Chine'];

  const exposed = $derived(theme === 'all' ? [] : THEME_ASSETS[theme].map(findAsset).filter(Boolean));
  const exposedLoad = $derived(exposed.length ? quotes(exposed, settings.period, settings.currency) : null);
  const periodLong = $derived(PERIODS.find((p) => p.id === settings.period).long);

  const inScope = (n) => settings.region === 'world' || n.region === settings.region || n.region === 'world';
  const items = $derived(
    live.items.map((n) => ({ ...n, hits: watchHits(n, settings.watch), fresh: n.seen > live.mark })),
  );
  const freshCount = $derived(items.filter((n) => n.fresh).length);
  const todayHits = $derived(items.filter((n) => n.hits.length && Date.now() - n.at < 86400000).length);
  const suggestions = $derived(SUGGEST.filter((s) => !settings.watch.some((w) => w.toLowerCase() === s.toLowerCase())).slice(0, 5));

  function addKw(w) {
    w = w.trim();
    if (w && !settings.watch.some((x) => x.toLowerCase() === w.toLowerCase())) settings.watch.push(w);
    kw = '';
  }
  const removeKw = (w) => (settings.watch = settings.watch.filter((x) => x !== w));
  function explain(m) {
    const a = findAsset(m.id);
    why[m.id] = why[m.id] || !a ? null : latest(...queries(a));
  }

  /** Part des titres des 3 derniers jours qui évoquent chaque facteur. */
  function thermo(list) {
    const recent = list.filter((n) => inScope(n) && Date.now() - n.at < 3 * 86400000);
    const rows = THEMES.map((t) => ({ ...t, n: recent.filter((x) => x.themes.includes(t.id)).length }));
    return { rows: rows.sort((a, b) => b.n - a.n), max: Math.max(...rows.map((r) => r.n), 1), total: recent.length };
  }
  const view = $derived.by(() => {
    const s = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (cat === 'all' || n.cat === cat) &&
        (theme === 'all' || n.themes.includes(theme)) &&
        (lang === 'all' || n.lang === lang) &&
        (!onlyWatch || n.hits.length) &&
        inScope(n) &&
        (!s || (n.title + ' ' + n.desc).toLowerCase().includes(s)),
    );
  });
</script>

<div>
  <h1 class="title">Actualités</h1>
  <div class="live-bar">
    <span class="live-dot {live.status === 'error' ? 'off' : 'on'}"></span>
    {#if live.status === 'loading'}
      Connexion aux sources…
    {:else if live.status === 'error'}
      Sources injoignables pour l’instant. Nouvel essai dans une minute.
    {:else}
      <span>
        <b>En direct</b> · vérifié {ago(live.checkedAt, live.now)} · {live.sources} sources, relues chaque minute
        {#if freshCount}· <b style="color:var(--accent)">{freshCount} nouveaux</b> depuis votre dernier passage{/if}
      </span>
    {/if}
  </div>
</div>

<div class="two">
  <div class="card">
    <div class="section-title">
      <h2>Mouvements inhabituels</h2>
      {#if live.watched}<span class="muted small">{live.watched} actifs surveillés</span>{/if}
    </div>
    {#each live.moves as m (m.id + m.at)}
      <div class="move">
        <div>
          <span class="name">{m.name}</span>
          <b class="num {dir(m.change)}">{pct(m.change, 1)}</b>
          <span class="muted small">en {m.mins} min</span>
          <div class="muted small">≈ {Math.round(m.ratio)}× l’amplitude habituelle · {ago(m.at, live.now)}</div>
        </div>
        <button class="chip" style="align-self:center" onclick={() => explain(m)}>{why[m.id] ? 'Masquer' : 'Pourquoi ?'}</button>
        {#if why[m.id]}
          <div class="why">
            {#await why[m.id]}
              <span class="muted small">Recherche des titres de la dernière heure…</span>
            {:then list}
              {#each list as n (n.link)}
                <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title} <span class="muted small">· {n.source}, {ago(n.at, live.now)}</span></a>
              {:else}
                <span class="muted small">Aucun article dans l’heure : le mouvement précède peut-être la dépêche. Réessayez dans quelques minutes.</span>
              {/each}
            {:catch}
              <span class="muted small">Recherche indisponible.</span>
            {/await}
            <button class="link" style="align-self:flex-start" onclick={() => openDetail(findAsset(m.id))}>Ouvrir la fiche</button>
          </div>
        {/if}
      </div>
    {:else}
      <p class="muted small">
        {live.movesAt ? 'Rien d’anormal pour l’instant.' : 'Analyse en cours…'}
        Chaque minute, BACUS compare la variation des 30 dernières minutes à l’amplitude habituelle des grands indices, du VIX,
        du pétrole, de l’or, des taux US, de l’euro-dollar, du Bitcoin, de l’Ether et de vos favoris. Un mouvement brusque
        précède souvent la dépêche qui l’explique.
      </p>
    {/each}
  </div>

  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="section-title" style="margin:0">
      <h2>Mots-clés surveillés</h2>
      {#if settings.watch.length}<span class="muted small">{todayHits} articles en 24 h</span>{/if}
    </div>
    {#if settings.watch.length}
      <div class="toolbar">
        {#each settings.watch as w (w)}
          <span class="chip on kw">{w}<button aria-label="Retirer {w}" onclick={() => removeKw(w)}>×</button></span>
        {/each}
      </div>
    {/if}
    <form class="toolbar" onsubmit={(e) => { e.preventDefault(); addKw(kw); }}>
      <input class="input" placeholder="Ajouter un mot-clé (Fed, LVMH, Taïwan…)" bind:value={kw} />
      <button class="btn" type="submit">Ajouter</button>
    </form>
    {#if suggestions.length}
      <div class="toolbar">
        {#each suggestions as s}<button class="chip ghost" onclick={() => addKw(s)}>+ {s}</button>{/each}
      </div>
    {/if}
    <p class="muted small">
      Un article qui cite l’un de ces mots est mis en avant et déclenche une alerte, quel que soit l’onglet ouvert.
      Les communiqués de la Fed et de la BCE déclenchent toujours une alerte.
    </p>
  </div>
</div>

{#if live.status === 'loading' && !items.length}
  <div class="skel" style="height:190px"></div>
  <div class="news">{#each Array(4) as _}<div class="skel" style="height:120px"></div>{/each}</div>
{:else if live.status === 'error' && !items.length}
  <div class="card error">Aucun flux d’actualités n’a répondu. Vérifiez la connexion.</div>
{:else}
  {@const th = thermo(items)}
  <div class="card">
    <div class="section-title">
      <h2>De quoi parle-t-on en ce moment ?</h2>
      {#if theme !== 'all'}<button onclick={() => (theme = 'all')}>Tout afficher</button>{/if}
    </div>
    {#each th.rows as t (t.id)}
      <button class="hbar" class:dim={theme !== 'all' && theme !== t.id} onclick={() => (theme = theme === t.id ? 'all' : t.id)}>
        <span class="hbar-label">{t.label}</span>
        <span class="hbar-track"><span class="hbar-fill warn" style="width:{(t.n / th.max) * 100}%"></span></span>
        <b class="num">{t.n}</b>
      </button>
    {/each}
    <p class="muted small" style="margin-top:8px">
      Nombre de titres des 3 derniers jours évoquant chaque facteur, sur {th.total} analysés. Touchez un facteur pour filtrer
      et voir les actifs qui y sont exposés.
    </p>
  </div>

  {#if exposed.length}
    <div>
      <div class="section-title"><h2>Actifs exposés · {themeLabel[theme]}</h2><span class="muted small">{periodLong}</span></div>
      {#await exposedLoad}
        <div class="skel" style="min-height:44px"></div>
      {:then q}
        <div class="filters" style="padding:0">
          {#each exposed as a (a.id)}
            {@const x = q?.get(a.id)}
            {#if x}
              <button class="chip" onclick={() => openDetail(a)}>
                {short(a.name)} <b class="num {dir(x.change)}">{pct(x.change, 1)}</b>
              </button>
            {/if}
          {/each}
        </div>
      {:catch}
        <span class="muted small">Cotations indisponibles.</span>
      {/await}
    </div>
  {/if}

  <div class="filters" style="padding:0">
    <Chips options={NEWS_CATS} bind:value={cat} label="Rubrique" />
    <span class="sep"></span>
    <Chips options={LANGS} bind:value={lang} label="Langue" />
    {#if settings.watch.length}
      <span class="sep"></span>
      <button class="chip" class:on={onlyWatch} onclick={() => (onlyWatch = !onlyWatch)}>Mes mots-clés</button>
    {/if}
  </div>
  <input class="input" type="search" placeholder="Rechercher un mot-clé (ex. tarifs, Fed, Ukraine)…" bind:value={search} />

  <div class="news">
    {#each view.slice(0, limit) as n (n.link)}
      <a class="card article" class:fresh={n.fresh} class:hit={n.hits.length} href={n.link} target="_blank" rel="noopener noreferrer">
        <div class="meta">
          <b>{n.source}</b> · {ago(n.at, live.now)}
          {#if n.lang === 'en'}<span class="tag">EN</span>{/if}
          {#if n.fresh}<span class="tag new">Nouveau</span>{/if}
          {#if n.official}<span class="tag official">Officiel</span>{/if}
          {#each n.hits as w}<span class="tag watch">{w}</span>{/each}
          {#each n.themes as t}<span class="tag hot">{themeLabel[t]}</span>{/each}
        </div>
        <h3>{n.title}</h3>
        {#if n.desc}<p>{n.desc}</p>{/if}
      </a>
    {:else}
      <div class="card empty">Aucun article avec ces filtres.</div>
    {/each}
  </div>
  {#if view.length > limit}
    <button class="chip" style="align-self:center" onclick={() => (limit += 30)}>Afficher plus</button>
  {/if}
  <p class="muted small">
    Extraits issus des flux RSS publics des éditeurs (France, Royaume-Uni, États-Unis, Allemagne, Asie, Moyen-Orient) et des
    communiqués de la Fed et de la BCE ; chaque carte ouvre l’article d’origine.
  </p>
{/if}
