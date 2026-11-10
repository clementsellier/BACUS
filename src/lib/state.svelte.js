// État partagé de l'application (filtres, navigation, favoris), conservé entre deux lancements.
const KEY = 'bacus.settings.v1';

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch {
  /* stockage indisponible : on repart des valeurs par défaut */
}

export const settings = $state({
  region: 'world',
  currency: 'EUR',
  period: '1mo',
  theme: 'dark',
  favorites: [],
  ...saved,
});

export const ui = $state({ tab: 'overview', detail: null });

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignoré */
  }
}

export function openDetail(asset) {
  ui.detail = asset;
  history.pushState({ detail: true }, '');
}

export function closeDetail() {
  if (history.state?.detail) history.back();
  else ui.detail = null;
}

export function toggleFav(id) {
  const k = settings.favorites.indexOf(id);
  if (k >= 0) settings.favorites.splice(k, 1);
  else settings.favorites.push(id);
}
