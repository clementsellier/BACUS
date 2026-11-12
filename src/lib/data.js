// Accès aux données de marché : Yahoo Finance (actions, indices, foncières, macro, devises),
// CoinGecko (cryptomonnaies) et FRED/BIS (prix de l'immobilier résidentiel).
import { get } from './net.js';

const Y = 'https://query1.finance.yahoo.com/v8/finance/spark';
const CG = 'https://api.coingecko.com/api/v3';

const LIST_RANGE = {
  '1d': ['1d', '5m'], '5d': ['5d', '30m'], '1mo': ['1mo', '1d'],
  '3mo': ['3mo', '1d'], '1y': ['1y', '1wk'], '5y': ['5y', '1mo'],
};
const DAY = 86400;
const SPAN = { '1mo': 31 * DAY, '3mo': 92 * DAY, '1y': 366 * DAY };

const baseCur = (c) => (c === 'GBp' ? 'GBP' : c);
const unit = (c) => (c === 'GBp' ? 0.01 : 1);
const fxSymbol = (from, to) => `${from}${to}=X`;
/** Les indices restent en points ; seuls les actifs cotés dans une devise sont convertis. */
const needsFx = (asset, cur) => asset.cur && asset.kind !== 'index' && baseCur(asset.cur) !== cur;

export async function spark(symbols, range, interval, ttl) {
  const out = {};
  const chunks = [];
  for (let k = 0; k < symbols.length; k += 15) chunks.push(symbols.slice(k, k + 15));
  await Promise.all(
    chunks.map(async (c) => {
      const url = `${Y}?symbols=${c.map(encodeURIComponent).join(',')}&range=${range}&interval=${interval}`;
      try {
        Object.assign(out, await get(url, { ttl }));
      } catch {
        /* un lot en échec n'empêche pas les autres */
      }
    }),
  );
  return out;
}

export function toPoints(raw) {
  if (!raw?.timestamp) return [];
  const pts = [];
  for (let k = 0; k < raw.timestamp.length; k++) {
    const v = raw.close[k];
    if (v != null && Number.isFinite(v)) pts.push({ t: raw.timestamp[k], v });
  }
  return pts;
}

/** Convertit une série point par point avec le dernier taux de change connu à chaque date. */
function convert(points, fx, k = 1) {
  if (!fx.length) return null;
  let j = 0;
  return points.map((p) => {
    while (j + 1 < fx.length && fx[j + 1].t <= p.t) j++;
    return { t: p.t, v: p.v * k * fx[j].v };
  });
}

/** Cotations d'une liste d'actifs sur la période choisie : prix, variation, mini-courbe. */
export async function quotes(assets, period, cur) {
  const [range, interval] = LIST_RANGE[period];
  const fxNeeded = new Set();
  for (const a of assets) if (needsFx(a, cur)) fxNeeded.add(fxSymbol(baseCur(a.cur), cur));
  const raw = await spark([...assets.map((a) => a.s), ...fxNeeded], range, interval, period === '1d' ? 60 : 600);
  const res = new Map();
  for (const a of assets) {
    const r = raw[a.s];
    let pts = toPoints(r);
    if (pts.length < 2) continue;
    let shown = a.kind === 'index' || !a.cur ? null : baseCur(a.cur);
    let k = unit(a.cur);
    let prev = period === '1d' && r.previousClose ? r.previousClose : pts[0].v;
    if (needsFx(a, cur)) {
      const fx = toPoints(raw[fxSymbol(baseCur(a.cur), cur)]);
      const conv = convert(pts, fx, k);
      if (conv) {
        prev = prev * k * fx[0].v;
        pts = conv;
        shown = cur;
        k = 1;
      }
    }
    if (k !== 1) {
      pts = pts.map((p) => ({ t: p.t, v: p.v * k }));
      prev *= k;
    }
    const price = pts[pts.length - 1].v;
    res.set(a.id, { price, change: price / prev - 1, spark: pts.map((p) => p.v), cur: shown });
  }
  return res;
}

/**
 * Historiques journaliers d'une liste d'actifs Yahoo.
 * Pour chaque actif : `pts` (convertis dans `cur`, si fourni) et `local` (devise de cotation).
 */
export async function history(assets, cur, range = '2y') {
  const fxNeeded = new Set();
  if (cur) for (const a of assets) if (needsFx(a, cur)) fxNeeded.add(fxSymbol(baseCur(a.cur), cur));
  const raw = await spark([...new Set(assets.map((a) => a.s)), ...fxNeeded], range, '1d', 900);
  const out = new Map();
  for (const a of assets) {
    const k = unit(a.cur);
    const local = toPoints(raw[a.s]).map((p) => ({ t: p.t, v: p.v * k }));
    if (local.length < 30) continue;
    let pts = local;
    let shown = a.kind === 'index' || !a.cur ? null : baseCur(a.cur);
    if (cur && needsFx(a, cur)) {
      const conv = convert(local, toPoints(raw[fxSymbol(baseCur(a.cur), cur)]));
      if (conv) {
        pts = conv;
        shown = cur;
      }
    }
    out.set(a.id, { pts, local, cur: shown });
  }
  return out;
}

const KIND = { EQUITY: 'stock', ETF: 'stock', MUTUALFUND: 'stock', INDEX: 'index', CRYPTOCURRENCY: 'coin', CURRENCY: 'macro', FUTURE: 'macro' };
const TYPE_LABEL = { EQUITY: 'Action', ETF: 'ETF', MUTUALFUND: 'Fonds', INDEX: 'Indice', CRYPTOCURRENCY: 'Crypto', CURRENCY: 'Devise', FUTURE: 'Contrat à terme' };

/** Recherche universelle : n'importe quelle action, ETF, indice ou crypto connu de Yahoo Finance. */
export async function searchAssets(q) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&lang=fr-FR`;
  const d = await get(url, { ttl: 600 });
  return (d.quotes || [])
    .filter((x) => KIND[x.quoteType] && x.symbol)
    .map((x) => ({
      id: x.symbol, s: x.symbol, name: x.longname || x.shortname || x.symbol, kind: KIND[x.quoteType],
      sector: [TYPE_LABEL[x.quoteType], x.exchDisp].filter(Boolean).join(' · '), region: 'world', custom: true, type: x.quoteType,
    }));
}

/** Complète un résultat de recherche avec sa devise de cotation. */
export async function resolveAsset(a) {
  if (a.cur !== undefined) return a;
  const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(a.s)}?range=1d&interval=1d`, { ttl: 86400 });
  const m = d.chart.result[0].meta;
  return { ...a, cur: a.type === 'CURRENCY' || a.kind === 'index' ? null : m.currency || null };
}

/** Taux moyen des nouveaux crédits immobiliers, mensuel, en %. */
export async function mortgageRates(country) {
  if (country.src === 'fred') {
    const out = [];
    for (const p of await fredSeries('MORTGAGE30US')) {
      const d = new Date(p.t * 1000);
      const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (out.length && out[out.length - 1].key === key) out[out.length - 1] = { ...p, key };
      else out.push({ ...p, key });
    }
    return out.map(({ t, v }) => ({ t, v }));
  }
  const url = `https://data-api.ecb.europa.eu/service/data/MIR/M.${country.cc}.B.A2C.AM.R.A.2250.EUR.N?format=csvdata&detail=dataonly&startPeriod=2012-01`;
  const lines = (await get(url, { ttl: 86400, type: 'text' })).trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const iT = head.indexOf('TIME_PERIOD'), iV = head.indexOf('OBS_VALUE');
  const out = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    const v = parseFloat(f[iV]);
    if (Number.isFinite(v)) out.push({ t: Date.parse(f[iT] + '-01T00:00:00Z') / 1000, v });
  }
  if (!out.length) throw new Error('Taux indisponibles');
  return out;
}

export const housingSeries = (cc) => fredSeries(`Q${cc}N628BIS`);

/** Classement des cryptomonnaies par capitalisation, directement dans la devise choisie. */
export async function cryptoMarkets(cur) {
  const url = `${CG}/coins/markets?vs_currency=${cur.toLowerCase()}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d,30d,1y`;
  const rows = await get(url, { ttl: 180 });
  return rows.map((c) => ({
    id: c.id,
    s: c.symbol.toUpperCase(),
    name: c.name,
    kind: 'crypto',
    region: 'world',
    cur,
    image: c.image,
    rank: c.market_cap_rank,
    price: c.current_price,
    cap: c.market_cap,
    volume: c.total_volume,
    ch: {
      '1d': c.price_change_percentage_24h_in_currency / 100,
      '5d': c.price_change_percentage_7d_in_currency / 100,
      '1mo': c.price_change_percentage_30d_in_currency / 100,
      '1y': c.price_change_percentage_1y_in_currency / 100,
    },
    spark: c.sparkline_in_7d?.price ?? [],
  }));
}

export async function cryptoGlobal() {
  const d = (await get(`${CG}/global`, { ttl: 300 })).data;
  return { btcDom: d.market_cap_percentage.btc, capChange: d.market_cap_change_percentage_24h_usd / 100 };
}

async function fredSeries(id) {
  const csv = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { ttl: 86400, type: 'text' });
  const pts = [];
  for (const line of csv.trim().split('\n').slice(1)) {
    const [d, v] = line.split(',');
    const x = parseFloat(v);
    if (Number.isFinite(x)) pts.push({ t: Date.parse(d + 'T00:00:00Z') / 1000, v: x });
  }
  return pts;
}

/** Prix du résidentiel par pays : dernier indice, variations sur 1 an et 5 ans. */
export async function housingList(countries) {
  const all = await Promise.allSettled(countries.map((c) => fredSeries(c.s)));
  const out = [];
  all.forEach((r, k) => {
    if (r.status !== 'fulfilled' || r.value.length < 21) return;
    const p = r.value;
    const last = p[p.length - 1];
    out.push({
      ...countries[k],
      price: last.v,
      asOf: last.t,
      y1: last.v / p[p.length - 5].v - 1,
      y5: last.v / p[p.length - 21].v - 1,
      spark: p.slice(-40).map((x) => x.v),
    });
  });
  return out;
}

/** Périodes proposées dans la fiche détaillée, selon la nature de l'actif. */
export function detailRanges(asset) {
  if (asset.kind === 'housing')
    return [{ id: 'h5', label: '5A' }, { id: 'h10', label: '10A' }, { id: 'h20', label: '20A' }, { id: 'hmax', label: 'Max' }];
  const base = [
    { id: '1d', label: '1J' }, { id: '5d', label: '1S' }, { id: '1mo', label: '1M' },
    { id: '3mo', label: '3M' }, { id: '1y', label: '1A' },
  ];
  return asset.kind === 'crypto' ? base : [...base, { id: '5y', label: '5A' }];
}

/**
 * Données complètes d'un actif : la série affichée, plus la série « modèle »
 * (historique régulier servant aux indicateurs et à la projection).
 * ppy = nombre de périodes par an de la série modèle.
 */
export async function loadDetail(asset, range, cur) {
  if (asset.kind === 'housing') {
    const all = await fredSeries(asset.s);
    const years = { h5: 5, h10: 10, h20: 20 }[range];
    const points = years ? all.slice(-(years * 4 + 1)) : all;
    return { points, model: all, ppy: 4, cur: null, intraday: false };
  }

  if (asset.kind === 'crypto') {
    const vs = cur.toLowerCase();
    const chart = async (days) =>
      (await get(`${CG}/coins/${asset.id}/market_chart?vs_currency=${vs}&days=${days}`, { ttl: days === 1 ? 120 : 900 }))
        .prices.map(([ms, v]) => ({ t: Math.floor(ms / 1000), v }));
    const year = dedupeDaily(await chart(365));
    let points;
    if (range === '1d') points = await chart(1);
    else if (range === '5d') points = await chart(7);
    else points = slice(year, SPAN[range] ?? SPAN['1y']);
    return { points, model: year, ppy: 365, cur, intraday: range === '1d' || range === '5d' };
  }

  // Yahoo
  const convertIt = needsFx(asset, cur);
  const fxS = convertIt ? fxSymbol(baseCur(asset.cur), cur) : null;
  const syms = fxS ? [asset.s, fxS] : [asset.s];
  const k = unit(asset.cur);
  let shown = asset.kind === 'index' || !asset.cur ? null : baseCur(asset.cur);
  const fetchSeries = async (r, i, ttl) => {
    const raw = await spark(syms, r, i, ttl);
    let pts = toPoints(raw[asset.s]);
    if (!pts.length) throw new Error('Données indisponibles pour cet actif.');
    let prev = raw[asset.s].previousClose;
    if (fxS) {
      const fx = toPoints(raw[fxS]);
      const conv = convert(pts, fx, k);
      if (conv) {
        shown = cur;
        if (prev) prev = prev * k * fx[0].v;
        return { pts: conv, prev };
      }
    }
    if (k !== 1) pts = pts.map((p) => ({ t: p.t, v: p.v * k }));
    return { pts, prev: prev ? prev * k : null };
  };

  const daily = (await fetchSeries('2y', '1d', 900)).pts;
  let points, prev = null;
  if (range === '1d') ({ pts: points, prev } = await fetchSeries('1d', '5m', 60));
  else if (range === '5d') points = (await fetchSeries('5d', '15m', 120)).pts;
  else if (range === '5y') points = (await fetchSeries('5y', '1wk', 3600)).pts;
  else points = slice(daily, SPAN[range]);
  return {
    points, model: daily, ppy: asset.kind === 'coin' ? 365 : 252, cur: shown, prev,
    intraday: range === '1d' || range === '5d',
  };
}

function slice(points, span) {
  const from = points[points.length - 1].t - span;
  return points.filter((p) => p.t >= from);
}

/** CoinGecko renvoie parfois deux points le dernier jour : on n'en garde qu'un par jour. */
function dedupeDaily(points) {
  const out = [];
  for (const p of points) {
    const d = Math.floor(p.t / DAY);
    if (out.length && Math.floor(out[out.length - 1].t / DAY) === d) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}
