// État partagé de l'application (filtres, navigation, favoris, portefeuille), conservé entre deux lancements.
import { UNIVERSE } from './catalog.js';

const KEY = 'bacus.settings.v1';

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch {
  /* stockage indisponible : on repart des valeurs par défaut */
}

/** Cours relevés lors de la visite précédente, figés au lancement : sert au résumé « depuis votre dernière visite ». */
export const lastVisit = saved.snapshot ?? null;

export const settings = $state({
  region: 'world',
  currency: 'EUR',
  period: '1mo',
  theme: 'dark',
  favorites: [],
  positions: [], // [{ id, qty, cost }] — cost : prix d'achat unitaire, devise de cotation (facultatif)
  custom: [], // actifs trouvés par la recherche et conservés (favoris, portefeuille, comparaison)
  compare: ['^GSPC', '^FCHI', 'GC=F', 'BTC-USD'],
  snapshot: null, // { at, cur, prices } : dernier relevé de cours
  watch: [], // mots-clés surveillés dans le fil d'actualités
  chartStyle: 'line', // graphique de la fiche : courbe ou bougies
  newsReadAt: Date.now(), // dernier passage sur l'onglet Actualités (sert au compteur de nouveautés)
  ...saved,
});

// picker : { title, onpick } quand la recherche sert à choisir un actif pour un outil
export const ui = $state({ tab: 'overview', market: 'stocks', lab: 'compare', detail: null, search: false, picker: null });

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignoré */
  }
}

/** Retrouve un actif par son identifiant, dans le catalogue ou parmi ceux ajoutés par la recherche. */
export function findAsset(id) {
  return UNIVERSE.find((a) => a.id === id) ?? settings.custom.find((a) => a.id === id) ?? null;
}

/** Conserve un actif issu de la recherche pour pouvoir le retrouver au prochain lancement. */
export function remember(asset) {
  if (asset.custom && !settings.custom.some((a) => a.id === asset.id)) {
    const { id, s, name, kind, cur, sector, region } = asset;
    settings.custom.push({ id, s, name, kind, cur, sector, region, custom: true });
  }
}

export function openDetail(asset) {
  ui.search = false;
  ui.picker = null;
  ui.detail = asset;
  history.pushState({ detail: true }, '');
}

export function closeDetail() {
  if (history.state?.detail) history.back();
  else ui.detail = null;
}

export function goTab(tab, sub) {
  if (ui.detail) closeDetail();
  ui.tab = tab;
  if (tab === 'markets' && sub) ui.market = sub;
  if (tab === 'lab' && sub) ui.lab = sub;
  window.scrollTo(0, 0);
}

export function toggleFav(asset) {
  const k = settings.favorites.indexOf(asset.id);
  if (k >= 0) settings.favorites.splice(k, 1);
  else {
    remember(asset);
    settings.favorites.push(asset.id);
  }
}

export function addPosition(asset, qty, cost = null) {
  remember(asset);
  // La première vraie ligne remplace le portefeuille d'exemple.
  if (settings.positions.length && settings.positions.every((p) => p.demo)) settings.positions = [];
  const p = settings.positions.find((x) => x.id === asset.id);
  if (p) {
    // moyenne pondérée du prix d'achat quand on renforce une ligne
    if (cost != null && p.cost != null) p.cost = (p.cost * p.qty + cost * qty) / (p.qty + qty);
    else if (cost != null && p.cost == null) p.cost = cost;
    p.qty += qty;
  } else settings.positions.push({ id: asset.id, qty, cost });
}

export function addCompare(asset) {
  remember(asset);
  if (!settings.compare.includes(asset.id)) settings.compare = [...settings.compare.slice(-4), asset.id];
}
