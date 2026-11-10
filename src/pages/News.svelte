<script>
  import Chips from '../components/Chips.svelte';
  import { settings } from '../lib/state.svelte.js';
  import { loadNews, NEWS_CATS, THEMES, ago } from '../lib/news.js';

  let cat = $state('all');
  let theme = $state('all');
  let search = $state('');
  let limit = $state(30);
  const load = $derived(loadNews());
  const themeOpts = [{ id: 'all', label: 'Tous les facteurs' }, ...THEMES];
  const themeLabel = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));

  function view(items) {
    const s = search.trim().toLowerCase();
    return items.filter(
      (n) =>
        (cat === 'all' || n.cat === cat) &&
        (theme === 'all' || n.themes.includes(theme)) &&
        (settings.region === 'world' || n.region === settings.region || n.region === 'world') &&
        (!s || (n.title + ' ' + n.desc).toLowerCase().includes(s)),
    );
  }
</script>

<div>
  <h1 class="title">Actualités</h1>
  <p class="muted">Les événements qui peuvent faire bouger les marchés.</p>
</div>

<div class="filters" style="padding:0">
  <Chips options={NEWS_CATS} bind:value={cat} label="Rubrique" />
</div>
<div class="filters" style="padding:0">
  <Chips options={themeOpts} bind:value={theme} label="Facteur de marché" />
</div>
<input class="input" type="search" placeholder="Rechercher un mot-clé (ex. tarifs, Fed, Ukraine)…" bind:value={search} />

{#await load}
  <div class="news">{#each Array(6) as _}<div class="skel" style="height:120px"></div>{/each}</div>
{:then items}
  {@const list = view(items)}
  <div class="news">
    {#each list.slice(0, limit) as n (n.link)}
      <a class="card article" href={n.link} target="_blank" rel="noopener noreferrer">
        <div class="meta">
          <b>{n.source}</b> · {ago(n.at)}
          {#each n.themes as t}<span class="tag hot">{themeLabel[t]}</span>{/each}
        </div>
        <h3>{n.title}</h3>
        {#if n.desc}<p>{n.desc}</p>{/if}
      </a>
    {:else}
      <div class="card empty">Aucun article avec ces filtres.</div>
    {/each}
  </div>
  {#if list.length > limit}
    <button class="chip" style="align-self:center" onclick={() => (limit += 30)}>Afficher plus</button>
  {/if}
  <p class="muted small">Extraits issus des flux RSS publics des éditeurs ; chaque carte ouvre l’article d’origine.</p>
{:catch}
  <div class="card error">Aucun flux d’actualités n’a répondu. Vérifiez la connexion.</div>
{/await}
