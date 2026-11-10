<script>
  import Row from '../components/Row.svelte';
  import { settings, openDetail } from '../lib/state.svelte.js';
  import { cryptoMarkets, cryptoGlobal } from '../lib/data.js';
  import { price, pct, compact, dir } from '../lib/format.js';

  let search = $state('');
  let sort = $state('cap');
  let noStable = $state(true);
  const STABLE = /^(usdt|usdc|dai|usde|usds|fdusd|pyusd|tusd|usd1|busd|usdd|rlusd|bsc-usd|susde|susds|usdtb|usdf|usdg)$/i;

  // CoinGecko fournit 24 h, 7 j, 30 j et 1 an : on prend la période la plus proche du filtre.
  const key = $derived({ '3mo': '1mo', '5y': '1y' }[settings.period] ?? settings.period);
  const keyLabel = { '1d': '24 h', '5d': '7 j', '1mo': '30 j', '1y': '1 an' };
  const load = $derived(cryptoMarkets(settings.currency));
  const global = $derived(cryptoGlobal().catch(() => null));

  function view(list) {
    const s = search.trim().toLowerCase();
    const out = list
      .filter((c) => !noStable || !STABLE.test(c.s))
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.s.toLowerCase().includes(s));
    if (sort === 'up') out.sort((a, b) => (b.ch[key] ?? -9) - (a.ch[key] ?? -9));
    if (sort === 'down') out.sort((a, b) => (a.ch[key] ?? 9) - (b.ch[key] ?? 9));
    if (sort === 'vol') out.sort((a, b) => b.volume - a.volume);
    if (sort === 'fav') out.sort((a, b) => settings.favorites.includes(b.id) - settings.favorites.includes(a.id));
    return out;
  }
</script>

<h1 class="title">Cryptomonnaies</h1>

{#await global then g}
  {#if g}
    <div class="grid">
      <div class="card tile">
        <span class="k">Capitalisation totale · 24 h</span>
        <span class="v num {dir(g.capChange)}">{pct(g.capChange)}</span>
      </div>
      <div class="card tile">
        <span class="k">Dominance du Bitcoin</span>
        <span class="v num">{g.btcDom.toFixed(1).replace('.', ',')} %</span>
      </div>
    </div>
  {/if}
{/await}

<div class="toolbar">
  <input class="input" type="search" placeholder="Rechercher une crypto…" bind:value={search} />
  <select class="select" bind:value={sort} aria-label="Tri">
    <option value="cap">Capitalisation</option>
    <option value="up">Plus fortes hausses</option>
    <option value="down">Plus fortes baisses</option>
    <option value="vol">Volume 24 h</option>
    <option value="fav">Favoris d’abord</option>
  </select>
  <button class="chip" class:on={noStable} onclick={() => (noStable = !noStable)}>Sans stablecoins</button>
</div>

{#await load}
  {#each Array(7) as _}<div class="skel"></div>{/each}
{:then list}
  <div class="card flush">
    {#each view(list) as c (c.id)}
      <Row
        name={c.name}
        sub={`#${c.rank} · ${c.s} · cap. ${compact(c.cap, c.cur)}`}
        image={c.image}
        priceText={price(c.price, c.cur)}
        change={c.ch[key]}
        spark={c.spark}
        onclick={() => openDetail(c)}
      />
    {:else}
      <div class="empty">Aucun résultat.</div>
    {/each}
  </div>
  <p class="muted small">
    Variation affichée : {keyLabel[key]} · mini-courbe sur 7 jours · le filtre de région ne s’applique pas aux
    cryptomonnaies (marché mondial).
  </p>
{:catch}
  <div class="card error">CoinGecko ne répond pas (limite de requêtes gratuite atteinte ?). Réessayez dans une minute.</div>
{/await}
