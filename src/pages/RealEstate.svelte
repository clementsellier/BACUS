<script>
  import Row from '../components/Row.svelte';
  import MultiChart from '../components/MultiChart.svelte';
  import { settings, openDetail } from '../lib/state.svelte.js';
  import { HOUSING, REITS, MORTGAGE, inRegion, flagEmoji } from '../lib/catalog.js';
  import { quotes, housingList, housingSeries, mortgageRates } from '../lib/data.js';
  import { annuity } from '../lib/analytics.js';
  import { price, pct, date, dir } from '../lib/format.js';

  let mode = $state('housing');
  let sort = $state('y1');
  const countries = $derived(inRegion(HOUSING, settings.region));
  const reits = $derived(inRegion(REITS, settings.region));
  const housing = $derived(mode === 'housing' ? housingList(countries) : null);
  const listed = $derived(mode === 'reit' ? quotes(reits, settings.period, settings.currency) : null);
  const sorted = (list) =>
    [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort] - a[sort]));

  // ---- Pouvoir d'achat immobilier : prix × taux de crédit
  let cc = $state('FR');
  let years = $state(20);
  let monthly = $state(1200);
  const country = $derived(MORTGAGE.find((m) => m.cc === cc));
  const afford = $derived(mode === 'afford' ? Promise.all([housingSeries(cc), mortgageRates(country)]) : null);
  const month = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  function compute([prices, rates]) {
    const rateAt = (t) => {
      let r = null;
      for (const p of rates) {
        if (p.t > t) break;
        r = p.v;
      }
      return r;
    };
    const from = prices[prices.length - 1].t - 10 * 365.25 * 86400;
    const pts = prices.filter((p) => p.t >= from).map((p) => ({ ...p, rate: rateAt(p.t) })).filter((p) => p.rate != null);
    if (pts.length < 8) return null;
    const pay = (p) => p.v * annuity(p.rate, years);
    const p0 = pts[0], p1 = pts[pts.length - 1];
    const window = rates.filter((r) => r.t >= from);
    const low = window.reduce((a, b) => (b.v < a.v ? b : a));
    const now = rates[rates.length - 1];
    return {
      lines: [
        { label: 'Prix des logements', color: '--c1', points: pts.map((p) => ({ t: p.t, v: (p.v / p0.v) * 100 })) },
        { label: `Mensualité pour le même bien (prêt sur ${years} ans)`, color: '--c2', points: pts.map((p) => ({ t: p.t, v: (pay(p) / pay(p0)) * 100 })) },
      ],
      priceChange: p1.v / p0.v - 1,
      payChange: pay(p1) / pay(p0) - 1,
      start: p0.t, end: p1.t, now, low,
    };
  }
  const capacity = (rate) => monthly / annuity(rate, years);
</script>

<div class="toolbar">
  <div class="seg">
    <button class:on={mode === 'housing'} onclick={() => (mode = 'housing')}>Prix des logements</button>
    <button class:on={mode === 'afford'} onclick={() => (mode = 'afford')}>Pouvoir d’achat</button>
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
{:else if mode === 'afford'}
  <p class="muted">
    Le prix affiché ne dit pas tout : ce qui compte pour un acheteur à crédit, c’est la mensualité. On la reconstitue ici en
    croisant les prix et les taux des nouveaux crédits immobiliers.
  </p>
  <div class="toolbar">
    <select class="select" bind:value={cc} aria-label="Pays">
      {#each MORTGAGE as m}<option value={m.cc}>{m.name}</option>{/each}
    </select>
    <select class="select" bind:value={years} aria-label="Durée du prêt">
      {#each [15, 20, 25, 30] as y}<option value={y}>Prêt sur {y} ans</option>{/each}
    </select>
  </div>
  {#await afford}
    <div class="skel" style="height:340px"></div>
  {:then data}
    {@const r = data && compute(data)}
    {#if r}
      <div class="grid">
        <div class="card tile kpi">
          <span class="k">Prix depuis {new Date(r.start * 1000).getUTCFullYear()}</span>
          <span class="v num {dir(r.priceChange)}">{pct(r.priceChange, 0)}</span>
          <span class="muted small">jusqu’à {month(r.end)}</span>
        </div>
        <div class="card tile kpi">
          <span class="k">Mensualité pour le même bien</span>
          <span class="v num {dir(-r.payChange)}">{pct(r.payChange, 0)}</span>
          <span class="muted small">prix et taux combinés</span>
        </div>
        <div class="card tile kpi">
          <span class="k">Taux moyen actuel</span>
          <span class="v num">{r.now.v.toFixed(2).replace('.', ',')} %</span>
          <span class="muted small">{month(r.now.t)}</span>
        </div>
        <div class="card tile kpi">
          <span class="k">Plus bas sur 10 ans</span>
          <span class="v num">{r.low.v.toFixed(2).replace('.', ',')} %</span>
          <span class="muted small">{month(r.low.t)}</span>
        </div>
      </div>

      <div class="card" style="padding:10px 6px 6px">
        <MultiChart lines={r.lines} precision={0} />
      </div>

      <div class="card">
        <div class="section-title"><h2>Combien puis-je emprunter ?</h2></div>
        <div class="toolbar">
          <label class="muted small" for="monthly">Mensualité ({country.cur}) :</label>
          <input id="monthly" class="input" style="max-width:140px" type="number" min="100" step="50" bind:value={monthly} />
        </div>
        {#if monthly > 0}
          {@const capNow = capacity(r.now.v)}
          {@const capLow = capacity(r.low.v)}
          <div class="grid" style="margin-top:12px">
            <div class="tile" style="padding:0">
              <span class="k">Aujourd’hui, à {r.now.v.toFixed(2).replace('.', ',')} %</span>
              <span class="v num">{price(capNow, country.cur)}</span>
            </div>
            <div class="tile" style="padding:0">
              <span class="k">Au plus bas des taux ({month(r.low.t)})</span>
              <span class="v num">{price(capLow, country.cur)}</span>
            </div>
            <div class="tile" style="padding:0">
              <span class="k">Écart de capacité d’emprunt</span>
              <span class="v num {dir(capNow / capLow - 1)}">{pct(capNow / capLow - 1, 0)}</span>
            </div>
          </div>
          <p class="muted small" style="margin-top:10px">
            Un point de taux en plus retirerait encore {pct(1 - capacity(r.now.v + 1) / capNow, 0).replace('+', '')} de capacité
            d’emprunt à mensualité égale.
          </p>
        {/if}
      </div>
      <p class="note">
        Taux : moyenne des nouveaux crédits à l’habitat ({country.src === 'ecb' ? 'Banque centrale européenne' : 'Freddie Mac, prêt fixe 30 ans, via FRED'}).
        Prix : indice BIS. Calcul hors assurance, frais et apport ; les revenus ne sont pas pris en compte.
      </p>
    {:else}
      <div class="card error">Données insuffisantes pour ce pays.</div>
    {/if}
  {:catch}
    <div class="card error">Impossible de charger les prix ou les taux de crédit.</div>
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
