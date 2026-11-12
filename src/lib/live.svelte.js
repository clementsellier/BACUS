// Fil en direct : tant que l'application est ouverte, relit les flux rapides chaque minute,
// repère les articles nouveaux et ceux qui citent un mot-clé surveillé, et guette les mouvements
// de prix inhabituels (souvent visibles avant que la dépêche ne sorte).
import { settings, findAsset } from './state.svelte.js';
import { fetchNews, watchHits } from './news.js';
import { spark, toPoints } from './data.js';

const POLL_MS = 60_000;
const MAX_TOASTS = 3;

export const live = $state({
  items: [],
  status: 'loading', // loading | ok | error
  sources: 0,
  checkedAt: 0,
  now: Date.now(), // horloge rafraîchie toutes les 15 s pour les « il y a … »
  mark: settings.newsReadAt, // articles vus pour la première fois après cet instant : marqués « Nouveau »
  moves: [], // mouvements inhabituels détectés
  watched: 0, // nombre d'actifs surveillés par le détecteur
  movesAt: 0,
  toasts: [],
});

// Actifs surveillés en plus des favoris : grands indices, peur du marché, matières premières, taux, change, crypto.
const MOVE_IDS = ['^GSPC', '^IXIC', '^DJI', '^FCHI', '^GDAXI', '^FTSE', '^N225', '^HSI', '^VIX', 'BZ=F', 'GC=F', '^TNX', 'EURUSD=X', 'DX-Y.NYB', 'BTC-USD', 'ETH-USD'];
// Requête en anglais pour chercher la cause d'un mouvement.
const EN = {
  '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow Jones', '^FCHI': 'CAC 40', '^GDAXI': 'DAX', '^FTSE': 'FTSE 100',
  '^N225': 'Nikkei', '^HSI': 'Hang Seng', '^VIX': 'VIX volatility', 'BZ=F': 'oil prices', 'GC=F': 'gold price',
  '^TNX': 'Treasury yields', 'EURUSD=X': 'euro dollar', 'DX-Y.NYB': 'dollar index', 'BTC-USD': 'bitcoin', 'ETH-USD': 'ether',
};
const FR = { '^VIX': 'VIX volatilité', 'BZ=F': 'pétrole', 'GC=F': 'or once', '^TNX': 'taux américains', 'EURUSD=X': 'euro dollar', 'DX-Y.NYB': 'dollar' };

export const shortName = (a) => a.name.split(/ [—(]/)[0];
export const queries = (a) => [FR[a.id] ?? shortName(a), EN[a.id] ?? shortName(a)];

const firstSeen = new Map(); // lien → première fois que l'article a été vu
let booted = false;
let polling = false;
let timer = null;
let toastId = 0;

export function toast(t) {
  const item = { id: ++toastId, ...t };
  live.toasts = [...live.toasts.slice(-(MAX_TOASTS - 1)), item];
  setTimeout(() => dismiss(item.id), 12_000);
}
export function dismiss(id) {
  live.toasts = live.toasts.filter((t) => t.id !== id);
}

async function pollNews() {
  try {
    const { items, ok } = await fetchNews({ live: true });
    const t = Date.now();
    const fresh = [];
    for (const it of items) {
      if (!firstSeen.has(it.link)) {
        // Au premier chargement, on se fie à la date de publication ; ensuite, à l'heure de découverte.
        firstSeen.set(it.link, booted ? t : it.at || t);
        if (booted) fresh.push(it);
      }
      it.seen = firstSeen.get(it.link);
    }
    live.items = items;
    live.sources = ok;
    live.checkedAt = t;
    live.status = 'ok';
    if (booted) {
      // Alerte seulement pour les articles récents (un agrégateur peut faire remonter un titre ancien).
      const hits = fresh
        .filter((it) => t - it.at < 3 * 3600_000)
        .map((it) => ({ it, w: watchHits(it, settings.watch) }))
        .filter((x) => x.w.length || x.it.official);
      for (const { it, w } of hits.slice(0, MAX_TOASTS)) {
        toast({ kind: 'news', title: it.title, sub: `${it.source} · ${w.length ? w.join(', ') : 'communiqué officiel'}`, link: it.link });
      }
    }
    booted = true;
  } catch {
    if (!live.items.length) live.status = 'error';
  }
}

// ---------- Détecteur de mouvements inhabituels ----------

/** Écart type robuste (médiane des écarts absolus) des variations sur 15 min : ignore les trous de nuit et de week-end. */
function robustSigma(pts) {
  const r = [];
  for (let k = 1; k < pts.length; k++) r.push(Math.log(pts[k].v / pts[k - 1].v));
  if (r.length < 20) return null;
  const med = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const m = med(r);
  const s = 1.4826 * med(r.map((x) => Math.abs(x - m)));
  return s > 0 ? s : null;
}

export function watchedAssets() {
  return [...new Set([...MOVE_IDS, ...settings.favorites])].map(findAsset).filter((a) => a && a.kind !== 'housing').slice(0, 30);
}

async function scanMoves() {
  const assets = watchedAssets();
  const syms = [...new Set(assets.map((a) => a.s))];
  const [base, now] = await Promise.all([spark(syms, '5d', '15m', 1800), spark(syms, '1d', '5m', 45)]);
  const t = Date.now();
  const nowS = t / 1000;
  for (const a of assets) {
    const sigma = robustSigma(toPoints(base[a.s]));
    const pts = toPoints(now[a.s]);
    if (!sigma || pts.length < 4) continue;
    const last = pts[pts.length - 1];
    if (nowS - last.t > 25 * 60) continue; // marché fermé ou cotation figée (indices : ~15 min de différé)
    let ref = null;
    for (let k = pts.length - 1; k >= 0; k--) if (pts[k].t <= last.t - 1800) { ref = pts[k]; break; }
    if (!ref) {
      if (last.t - pts[0].t < 900) continue;
      ref = pts[0]; // séance commencée il y a moins de 30 min
    }
    const mins = Math.round((last.t - ref.t) / 60);
    const r = Math.log(last.v / ref.v);
    const z = r / (sigma * Math.sqrt((last.t - ref.t) / 900));
    const floor = /=X$|^DX-Y/.test(a.s) ? 0.0015 : 0.003; // les devises bougent moins : seuil plus bas
    if (Math.abs(z) < 3.5 || Math.abs(r) < floor) continue;
    const move = { id: a.id, name: shortName(a), change: Math.exp(r) - 1, mins, ratio: Math.abs(z), price: last.v, at: t };
    const prev = live.moves.find((m) => m.id === a.id && t - m.at < 45 * 60_000 && Math.sign(m.change) === Math.sign(r));
    if (prev && Math.abs(move.change) < 1.5 * Math.abs(prev.change)) {
      Object.assign(prev, { change: move.change, mins, ratio: move.ratio, price: last.v, seenAt: t });
      continue;
    }
    live.moves = [move, ...live.moves.filter((m) => m !== prev)];
    const sign = move.change > 0 ? '+' : '−';
    toast({
      kind: 'move',
      title: `${move.name} ${sign}${Math.abs(move.change * 100).toFixed(1).replace('.', ',')} % en ${mins} min`,
      sub: `Mouvement inhabituel (≈ ${Math.round(move.ratio)}× l’amplitude habituelle)`,
      asset: a.id,
    });
  }
  // On garde 12 h d'historique.
  live.moves = live.moves.filter((m) => t - m.at < 12 * 3600_000).slice(0, 20);
  live.watched = assets.length;
  live.movesAt = t;
}

export async function pollNow() {
  if (polling) return;
  polling = true;
  try {
    await Promise.allSettled([pollNews(), scanMoves()]);
  } finally {
    polling = false;
  }
}

if (import.meta.env.DEV) window.__live = { live, toast }; // aide au test en développement

/** Lance la surveillance. Elle se met en pause quand l'application passe en arrière-plan. */
export function startLive() {
  if (timer) return;
  pollNow();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') pollNow();
  }, POLL_MS);
  setInterval(() => (live.now = Date.now()), 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - live.checkedAt > 30_000) pollNow();
  });
}

/**
 * Nouveautés depuis le dernier passage sur l'onglet Actualités.
 * important : articles citant un mot-clé surveillé, communiqués officiels et mouvements inhabituels ;
 * any : présence de n'importe quel nouvel article (une centaine par heure : on ne les compte pas).
 */
export function unread() {
  const since = settings.newsReadAt;
  const fresh = live.items.filter((i) => i.seen > since);
  const important =
    fresh.filter((i) => i.official || watchHits(i, settings.watch).length).length + live.moves.filter((m) => m.at > since).length;
  return { important, any: fresh.length > 0 };
}
