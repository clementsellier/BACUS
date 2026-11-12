// Actualités : lecture de flux RSS publics. On n'affiche que le titre, un court extrait
// et un lien vers l'article d'origine.
import { get } from './net.js';

const gnews = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;

export const NEWS_CATS = [
  { id: 'all', label: 'Tout' },
  { id: 'markets', label: 'Marchés' },
  { id: 'world', label: 'Monde' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'realestate', label: 'Immobilier' },
];

const gnewsEn = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

export const LANGS = [
  { id: 'all', label: 'Toutes langues' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'Anglais' },
];

// fast : flux qui publient plusieurs fois par heure, relus à chaque vérification du fil en direct
// (les autres sont relus toutes les 10 minutes). official : communiqués des banques centrales.
const FEEDS = [
  // Marchés — publication en continu
  { name: 'Le Monde', url: 'https://www.lemonde.fr/economie/rss_full.xml', cat: 'markets', region: 'eu', lang: 'fr', fast: true },
  { name: 'BFM Business', url: 'https://www.bfmtv.com/rss/economie/', cat: 'markets', region: 'eu', lang: 'fr', fast: true },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/market_currents.xml', cat: 'markets', region: 'na', lang: 'en', fast: true },
  { name: 'Financial Times', url: 'https://www.ft.com/markets?format=rss', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: 'The Guardian', url: 'https://www.theguardian.com/uk/business/rss', cat: 'markets', region: 'eu', lang: 'en', fast: true },
  { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', cat: 'markets', region: 'na', lang: 'en', fast: true },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', cat: 'markets', region: 'na', lang: 'en', fast: true },
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-bus', cat: 'markets', region: 'eu', lang: 'en', fast: true },
  { name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: 'OilPrice', url: 'https://oilprice.com/rss/main', cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: null, url: gnewsEn('stocks OR markets OR "Wall Street" OR Fed when:1h'), cat: 'markets', region: 'world', lang: 'en', fast: true },
  { name: null, url: gnews('bourse OR "CAC 40" OR "marchés financiers" OR "Wall Street" when:1h'), cat: 'markets', region: 'eu', lang: 'fr', fast: true },
  // Banques centrales : communiqués officiels (décisions de taux, discours)
  { name: 'Réserve fédérale', url: 'https://www.federalreserve.gov/feeds/press_all.xml', cat: 'markets', region: 'na', lang: 'en', fast: true, official: true },
  { name: 'BCE', url: 'https://www.ecb.europa.eu/rss/press.html', cat: 'markets', region: 'eu', lang: 'en', fast: true, official: true },
  // Marchés — régions et contexte
  { name: 'France 24', url: 'https://www.france24.com/fr/%C3%A9co-tech/rss', cat: 'markets', region: 'eu', lang: 'fr' },
  { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/92/feed', cat: 'markets', region: 'asia', lang: 'en' },
  { name: null, url: gnews('bourse marchés Asie when:3d'), cat: 'markets', region: 'asia', lang: 'fr' },
  { name: null, url: gnews('marchés émergents bourse when:7d'), cat: 'markets', region: 'em', lang: 'fr' },
  // Monde
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', cat: 'world', region: 'world', lang: 'en', fast: true },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/politics/news.rss', cat: 'world', region: 'na', lang: 'en', fast: true },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/international/rss_full.xml', cat: 'world', region: 'world', lang: 'fr' },
  { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', cat: 'world', region: 'world', lang: 'en' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', cat: 'world', region: 'world', lang: 'en' },
  { name: null, url: gnews('élections américaines midterms when:7d'), cat: 'world', region: 'na', lang: 'fr' },
  // Crypto
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', cat: 'crypto', region: 'world', lang: 'en', fast: true },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', cat: 'crypto', region: 'world', lang: 'en', fast: true },
  { name: null, url: gnews('cryptomonnaies bitcoin when:3d'), cat: 'crypto', region: 'world', lang: 'fr' },
  // Immobilier
  { name: 'Le Monde', url: 'https://www.lemonde.fr/immobilier/rss_full.xml', cat: 'realestate', region: 'eu', lang: 'fr' },
  { name: null, url: gnews('marché immobilier prix taux when:7d'), cat: 'realestate', region: 'world', lang: 'fr' },
];
export const FEED_COUNT = FEEDS.length;

// Facteurs susceptibles de faire bouger les marchés, repérés par mots-clés (FR + EN).
export const THEMES = [
  { id: 'geo', label: 'Géopolitique', re: /guerre|conflit|war\b|missile|sanction|otan|nato|ukraine|russi|gaza|isra[eë]l|iran|ta[iï]wan|cessez-le-feu|ceasefire|frappe|military|armée/i },
  { id: 'vote', label: 'Élections', re: /[ée]lection|midterm|mi-mandat|scrutin|vote\b|congr[eè]s|s[ée]nat|trump|maison blanche|white house|parlement|gouvernement/i },
  { id: 'rates', label: 'Banques centrales', re: /\bfed\b|\bbce\b|\becb\b|taux|inflation|interest rate|rate cut|banque centrale|central bank|powell|lagarde/i },
  { id: 'trade', label: 'Commerce', re: /tarif|tariff|douan|\btrade\b|guerre commerciale|protectionnis|export|embargo|surplus|exc[ée]dent commercial/i },
  { id: 'energy', label: 'Énergie', re: /p[ée]trole|\boil\b|opep|opec|gaz\b|\bgas\b|[ée]nergie|energy|brent/i },
  { id: 'tech', label: 'Tech & IA', re: /\bia\b|\bai\b|intelligence artificielle|nvidia|semi-conducteur|chip|openai|tech\b/i },
];

const strip = (html) => {
  const d = new DOMParser().parseFromString(html || '', 'text/html');
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const excerpt = (s, n = 190) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)) + '…';
};

function parse(xml, feed) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].slice(0, 25).map((it) => {
    const txt = (sel) => it.querySelector(sel)?.textContent?.trim() ?? '';
    let title = strip(txt('title'));
    let source = feed.name ?? txt('source');
    if (!feed.name) {
      // Google Actualités : « Titre - Source »
      const cutAt = title.lastIndexOf(' - ');
      if (cutAt > 0) {
        source = source || title.slice(cutAt + 3);
        title = title.slice(0, cutAt);
      }
    }
    const desc = feed.name ? excerpt(strip(txt('description'))) : '';
    // pubDate (RSS 2.0) ou dc:date (RSS 1.0 / RDF)
    let at = Date.parse(txt('pubDate') || txt('date')) || 0;
    if (at > Date.now() + 5 * 60000) at = Date.now(); // horodatage dans le futur : on le ramène à maintenant
    const hay = title + ' ' + desc;
    return {
      title, source, at, link: txt('link') || it.getAttribute('rdf:about') || '', cat: feed.cat, region: feed.region,
      lang: feed.lang, official: !!feed.official,
      desc: desc && desc !== title ? desc : '',
      themes: THEMES.filter((t) => t.re.test(hay)).map((t) => t.id),
    };
  });
}

/**
 * Lit tous les flux. Avec `live`, les flux rapides sont relus s'ils datent de plus de 45 s.
 * Renvoie les articles (sans doublon, du plus récent au plus ancien) et le nombre de flux qui ont répondu.
 */
export async function fetchNews({ live = false } = {}) {
  const res = await Promise.allSettled(
    FEEDS.map(async (f) => parse(await get(f.url, { ttl: live && f.fast ? 45 : 600, type: 'text' }), f)),
  );
  const seen = new Set();
  const items = [];
  let ok = 0;
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    ok++;
    for (const it of r.value) {
      const key = it.title.toLowerCase().slice(0, 60);
      if (!it.title || !it.link || seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  }
  if (!items.length) throw new Error('Aucun flux d’actualités n’a répondu.');
  return { items: items.sort((a, b) => b.at - a.at), ok };
}

export async function loadNews() {
  return (await fetchNews()).items;
}

/** Derniers titres (moins d'une heure) sur un sujet, en français et en anglais. */
export async function latest(fr, en = fr) {
  const res = await Promise.allSettled([
    get(gnews(`${fr} when:1h`), { ttl: 60, type: 'text' }).then((x) => parse(x, { name: null, lang: 'fr' })),
    get(gnewsEn(`${en} when:1h`), { ttl: 60, type: 'text' }).then((x) => parse(x, { name: null, lang: 'en' })),
  ]);
  const items = res.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return items.sort((a, b) => b.at - a.at).slice(0, 6);
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mots-clés surveillés présents dans un article (insensible à la casse et aux accents, début de mot). */
export function watchHits(item, words) {
  if (!words?.length) return [];
  const hay = fold(item.title + ' ' + item.desc);
  return words.filter((w) => new RegExp(`(^|[^a-z0-9])${esc(fold(w.trim()))}`).test(hay));
}

/** Titres de presse parus autour d'une date, pour éclairer un mouvement de cours. */
export async function causes(query, t) {
  const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const q = `${query} after:${day(t - 2 * 86400)} before:${day(t + 2 * 86400)}`;
  const items = parse(await get(gnews(q), { ttl: 3600, type: 'text' }), { name: null });
  return items.slice(0, 5);
}

export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
