<script>
  import Chart from '../components/Chart.svelte';
  import Donut from '../components/Donut.svelte';
  import { settings, ui, findAsset, addPosition, openDetail } from '../lib/state.svelte.js';
  import { CLASSES, PERIODS } from '../lib/catalog.js';
  import { history } from '../lib/data.js';
  import { portfolio } from '../lib/analytics.js';
  import { price, pct, dir, date } from '../lib/format.js';

  const SPAN = { '1d': 0, '5d': 7, '1mo': 31, '3mo': 92, '1y': 366, '5y': 731 };
  const holdable = (a) => a.kind === 'stock' || a.kind === 'reit' || a.kind === 'coin' || (a.kind === 'macro' && a.cur);

  const held = $derived(
    settings.positions.map((p) => ({ p, a: findAsset(p.id) })).filter((x) => x.a && x.p.qty > 0),
  );
  const key = $derived(held.map((x) => x.a.id).join('|'));
  const load = $derived.by(() => {
    key; // ne recharge que si la liste d'actifs change, pas à chaque modification de quantité
    return held.length ? history(held.map((x) => x.a), settings.currency, '2y') : null;
  });
  const periodLong = $derived(settings.period === '5y' ? 'sur 2 ans (historique maximal)' : PERIODS.find((p) => p.id === settings.period).long);

  function compute(hist) {
    const rows = held.filter((x) => hist.has(x.a.id)).map((x) => ({ ...x, qty: x.p.qty, ...hist.get(x.a.id) }));
    if (!rows.length) return null;
    const res = portfolio(rows, Date.now() / 1000 - SPAN[settings.period] * 86400);
    if (!res) return null;
    const items = rows.map((r, k) => ({ ...r, ...res.lines[k] })).sort((x, y) => y.value - x.value);
    const group = (keyOf, labelOf, colorOf) => {
      const m = new Map();
      for (const it of items) m.set(keyOf(it), (m.get(keyOf(it)) || 0) + it.value);
      return [...m].sort((x, y) => y[1] - x[1]).map(([k, v], i) => ({ label: labelOf(k), value: v, color: colorOf(k, i) }));
    };
    return {
      ...res, items,
      missing: held.length - rows.length,
      byClass: group((it) => it.a.kind, (k) => CLASSES[k].label, (k) => CLASSES[k].color),
      byCur: group((it) => (it.a.cur === 'GBp' ? 'GBP' : it.a.cur), (k) => k, (_, i) => `--c${(i % 5) + 1}`),
      chart: res.series.filter((p) => p.t >= res.startT),
    };
  }

  // Ajout / modification d'une ligne
  let draft = $state(null); // { asset, qty, cost }
  let editing = $state(null);
  function pick() {
    ui.picker = { title: 'Quelle valeur détenez-vous ?', filter: holdable, onpick: (asset) => (draft = { asset, qty: '', cost: '' }) };
  }
  const num = (v) => {
    const x = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  function confirm() {
    const qty = num(draft.qty);
    if (!qty) return;
    addPosition(draft.asset, qty, num(draft.cost));
    draft = null;
  }
  function remove(id) {
    settings.positions = settings.positions.filter((p) => p.id !== id);
    editing = null;
  }
  function example() {
    settings.positions = [
      { id: 'MSFT', qty: 6, cost: null }, { id: 'MC.PA', qty: 4, cost: null }, { id: 'TTE.PA', qty: 30, cost: null },
      { id: 'VNQ', qty: 15, cost: null }, { id: 'BTC-USD', qty: 0.04, cost: null }, { id: 'GC=F', qty: 0.5, cost: null },
    ];
  }
  const verdict = (c) => (c == null ? '—' : c < 0.3 ? 'Bonne' : c < 0.6 ? 'Moyenne' : 'Faible');
  const bar = (v, max) => `${Math.min(100, (Math.abs(v) / (max || 1)) * 100)}%`;
</script>

<div class="toolbar">
  <h1 class="title" style="flex:1">Portefeuille</h1>
  <button class="btn" onclick={pick}>+ Ajouter une ligne</button>
</div>

{#if draft}
  <div class="card">
    <div class="section-title"><h2>{draft.asset.name}</h2><button onclick={() => (draft = null)}>Annuler</button></div>
    <div class="toolbar">
      <input class="input" inputmode="decimal" placeholder="Quantité détenue" bind:value={draft.qty} />
      <input class="input" inputmode="decimal" placeholder={`Prix d’achat unitaire${draft.asset.cur ? ' en ' + draft.asset.cur : ''} (facultatif)`} bind:value={draft.cost} />
      <button class="btn" onclick={confirm} disabled={!num(draft.qty)}>Ajouter</button>
    </div>
  </div>
{/if}

{#if !held.length}
  <div class="card hero">
    <h2 style="font-size:18px">Tout votre patrimoine financier dans une seule devise</h2>
    <p class="muted" style="margin-top:6px">
      Ajoutez vos actions, ETF, foncières, cryptomonnaies ou votre or. BACUS additionne le tout dans la devise choisie, montre
      la part de la variation qui vient réellement de vos actifs et celle qui vient du taux de change, et mesure si vos lignes
      se protègent les unes les autres.
    </p>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn" onclick={pick}>Ajouter ma première ligne</button>
      <button class="chip" onclick={example}>Voir avec un exemple</button>
    </div>
    <p class="muted small" style="margin-top:10px">Les données restent sur votre appareil.</p>
  </div>
{:else}
  {#await load}
    <div class="skel" style="height:120px"></div>
    <div class="skel" style="height:300px"></div>
  {:then hist}
    {@const r = compute(hist)}
    {#if !r}
      <div class="card error">Cotations indisponibles pour ces lignes.</div>
    {:else}
      <div>
        <div class="muted small">Valeur totale</div>
        <div class="big num">{price(r.total, settings.currency)}</div>
        <span class="badge {dir(r.change)} num">{pct(r.change)}</span>
        <span class="muted small"> {periodLong}</span>
      </div>

      <div class="card" style="padding:10px 6px 6px">
        <Chart points={r.chart.length > 2 ? r.chart : r.series.slice(-30)} rising={r.change >= 0} />
      </div>

      <div class="card">
        <div class="section-title"><h2>D’où vient cette variation ?</h2></div>
        {#each [{ label: 'Vos actifs eux-mêmes', v: r.assetEffect }, { label: 'Les taux de change', v: r.fxEffect }] as e}
          <div class="hbar">
            <span class="hbar-label">{e.label}</span>
            <span class="hbar-track"><span class="hbar-fill {dir(e.v)}" style="width:{bar(e.v, Math.max(Math.abs(r.assetEffect), Math.abs(r.fxEffect)))}"></span></span>
            <b class="num {dir(e.v)}">{pct(e.v)}</b>
          </div>
        {/each}
        <p class="muted small" style="margin-top:8px">
          {#if Math.abs(r.fxEffect) < 0.002}
            Les devises n’ont presque pas joué sur la période.
          {:else}
            Sans variation des devises, votre portefeuille aurait fait {pct(r.assetEffect)} ; le change a
            {r.fxEffect > 0 ? 'ajouté' : 'retiré'} {pct(Math.abs(r.fxEffect)).replace('+', '')} une fois converti en {settings.currency}.
          {/if}
        </p>
      </div>

      <div class="two">
        <div class="card"><Donut segments={r.byClass} title="Par classe d’actifs" /></div>
        <div class="card"><Donut segments={r.byCur} title="Par devise d’exposition" /></div>
      </div>

      <div>
        <div class="section-title"><h2>Risque et diversification</h2></div>
        <div class="grid">
          <div class="card tile kpi">
            <span class="k">Volatilité annualisée</span>
            <span class="v num">{pct(r.vol, 1).replace('+', '')}</span>
            <span class="muted small">à composition actuelle, sur 2 ans</span>
          </div>
          <div class="card tile kpi">
            <span class="k">Pire journée</span>
            <span class="v num down">{pct(r.worstDay, 1)}</span>
            <span class="muted small">{date(r.worstAt)}</span>
          </div>
          <div class="card tile kpi">
            <span class="k">Pire repli</span>
            <span class="v num down">{pct(r.drawdown, 1)}</span>
            <span class="muted small">du plus haut au plus bas</span>
          </div>
          <div class="card tile kpi">
            <span class="k">Diversification</span>
            <span class="v">{verdict(r.avgCorr)}</span>
            <span class="muted small num">
              {r.items.length} lignes, qui pèsent comme {r.effective.toFixed(1).replace('.', ',')}
              {#if r.avgCorr != null}· corrélation moyenne {r.avgCorr.toFixed(2).replace('.', ',')}{/if}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div class="section-title"><h2>Lignes</h2></div>
        <div class="card flush">
          {#each r.items as it (it.a.id)}
            {@const gain = it.p.cost ? it.localPrice / it.p.cost - 1 : null}
            <div class="pos">
              <button class="pos-main" onclick={() => openDetail(it.a)}>
                <span class="avatar">{it.a.s.replace('^', '').slice(0, 3)}</span>
                <span style="min-width:0;flex:1">
                  <span class="name" style="display:block">{it.a.name}</span>
                  <span class="sub num" style="display:block">
                    {String(it.p.qty).replace('.', ',')} × {price(it.price, it.cur)} · {(it.weight * 100).toFixed(0)} % du total
                  </span>
                </span>
                <span class="vals num">
                  <span class="p" style="display:block">{price(it.value, settings.currency)}</span>
                  <span class="badge {dir(it.change)}">{pct(it.change)}</span>
                </span>
              </button>
              <div class="pos-foot small muted num">
                <span>Contribution : <b class={dir(it.contribution)}>{pct(it.contribution)}</b></span>
                {#if gain != null}<span>Depuis l’achat : <b class={dir(gain)}>{pct(gain, 1)}</b></span>{/if}
                <span class="spacer"></span>
                <button class="link" onclick={() => (editing = editing === it.a.id ? null : it.a.id)}>Modifier</button>
              </div>
              {#if editing === it.a.id}
                <div class="toolbar" style="padding:0 16px 12px">
                  <input class="input" inputmode="decimal" aria-label="Quantité" value={it.p.qty}
                    onchange={(e) => { const v = num(e.target.value); if (v) it.p.qty = v; }} />
                  <input class="input" inputmode="decimal" aria-label="Prix d’achat unitaire" placeholder="Prix d’achat unitaire" value={it.p.cost ?? ''}
                    onchange={(e) => (it.p.cost = num(e.target.value))} />
                  <button class="chip" style="color:var(--down)" onclick={() => remove(it.a.id)}>Supprimer</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
        {#if r.missing}<p class="muted small" style="margin-top:8px">{r.missing} ligne(s) sans cotation disponible, non comptée(s).</p>{/if}
        <p class="muted small" style="margin-top:8px">
          Contribution = part de la variation totale apportée par la ligne sur la période. Calculs à quantités constantes : les
          achats et ventes passés ne sont pas reconstitués.
        </p>
      </div>
    {/if}
  {:catch}
    <div class="card error">Impossible de charger les cotations du portefeuille.</div>
  {/await}
{/if}
