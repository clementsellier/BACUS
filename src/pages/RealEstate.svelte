<script>
  import Row from '../components/Row.svelte';
  import { settings, openDetail } from '../lib/state.svelte.js';
  import { HOUSING, REITS, inRegion, flagEmoji } from '../lib/catalog.js';
  import { quotes, housingList } from '../lib/data.js';
  import { price, pct, date } from '../lib/format.js';

  let mode = $state('housing');
  let sort = $state('y1');
  const countries = $derived(inRegion(HOUSING, settings.region));
  const reits = $derived(inRegion(REITS, settings.region));
  const housing = $derived(mode === 'housing' ? housingList(countries) : null);
  const listed = $derived(mode === 'reit' ? quotes(reits, settings.period, settings.currency) : null);
  const sorted = (list) =>
    [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
</script>

<h1 class="title">Immobilier</h1>

<div class="toolbar">
  <div class="seg">
    <button class:on={mode === 'housing'} onclick={() => (mode = 'housing')}>Prix des logements</button>
    <button class:on={mode === 'reit'} onclick={() => (mode = 'reit')}>Foncières cotées</button>
  </div>
  {#if mode === 'housing'}
    <select class="select" bind:value={sort} aria-label="Tri">
      <option value="y1">Variation sur 1 an</option>
      <option value="y5">Variation sur 5 ans</option>
      <option value="name">Pays</option>
    </select>
  {/if}
</div>

{#if mode === 'housing'}
  {#await housing}
    {#each Array(6) as _}<div class="skel"></div>{/each}
  {:then list}
    <div class="card flush">
      {#each sorted(list) as c (c.id)}
        <Row
          name={c.name}
          sub={`Publié : ${date(c.asOf)}`}
          avatar={flagEmoji(c.flag)}
          flag
          priceText={`Indice ${price(c.price)}`}
          change={c.y1}
          extra={`1 an · 5 ans : ${pct(c.y5, 0)}`}
          spark={c.spark}
          onclick={() => openDetail(c)}
        />
      {:else}
        <div class="empty">Données indisponibles pour cette région.</div>
      {/each}
    </div>
    <p class="note">
      Prix nominaux des logements, indices trimestriels de la Banque des règlements internationaux (base 100 en 2010),
      diffusés par FRED. Ils sont publiés avec plusieurs mois de décalage : le filtre de période ne s’applique pas ici, et
      un indice n’a pas de devise.
    </p>
  {:catch}
    <div class="card error">Impossible de charger les indices immobiliers.</div>
  {/await}
{:else}
  {#await listed}
    {#each Array(6) as _}<div class="skel"></div>{/each}
  {:then q}
    <div class="card flush">
      {#each reits as a (a.id)}
        {@const x = q.get(a.id)}
        {#if x}
          <Row
            name={a.name}
            sub={a.s}
            avatar={a.s.slice(0, 3)}
            priceText={price(x.price, x.cur)}
            change={x.change}
            spark={x.spark}
            onclick={() => openDetail(a)}
          />
        {/if}
      {/each}
    </div>
    <p class="note">
      Les foncières cotées (SIIC / REIT) réagissent chaque jour aux taux d’intérêt : c’est le thermomètre en temps réel de
      l’immobilier, là où les prix des logements ne sont connus qu’avec retard.
    </p>
  {:catch}
    <div class="card error">Impossible de charger les cotations.</div>
  {/await}
{/if}
