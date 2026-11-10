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

const FEEDS = [
  { name: 'Le Monde', url: 'https://www.lemonde.fr/economie/rss_full.xml', cat: 'markets', region: 'eu' },
  { name: 'France 24', url: 'https://www.france24.com/fr/%C3%A9co-tech/rss', cat: 'markets', region: 'eu' },
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', cat: 'markets', region: 'world' },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', cat: 'markets', region: 'na' },
  { name: null, url: gnews('bourse marchés Asie when:3d'), cat: 'markets', region: 'asia' },
  { name: null, url: gnews('marchés émergents bourse when:7d'), cat: 'markets', region: 'em' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/international/rss_full.xml', cat: 'world', region: 'world' },
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', cat: 'world', region: 'world' },
  { name: null, url: gnews('élections américaines midterms when:7d'), cat: 'world', region: 'na' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', cat: 'crypto', region: 'world' },
  { name: null, url: gnews('cryptomonnaies bitcoin when:3d'), cat: 'crypto', region: 'world' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/immobilier/rss_full.xml', cat: 'realestate', region: 'eu' },
  { name: null, url: gnews('marché immobilier prix taux when:7d'), cat: 'realestate', region: 'world' },
];

// Facteurs susceptibles de faire bouger les marchés, repérés par mots-clés (FR + EN).
export const THEMES = [
  { id: 'geo', label: 'Géopolitique', re: /guerre|conflit|war\b|missile|sanction|otan|nato|ukraine|russi|gaza|isra[eë]l|iran|ta[iï]wan|cessez-le-feu|ceasefire|frappe|military|armée/i },
  { id: 'vote', label: 'Élections', re: /[ée]lection|midterm|mi-mandat|scrutin|vote\b|congr[eè]s|s[ée]nat|trump|maison blanche|white house|parlement|gouvernement/i },
  { id: 'rates', label: 'Banques centrales', re: /\bfed\b|\bbce\b|\becb\b|taux|inflation|interest rate|rate cut|banque centrale|central bank|powell|lagarde/i },
  { id: 'trade', label: 'Commerce', re: /tarif|tariff|douan|trade war|guerre commerciale|export|embargo/i },
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
    const at = Date.parse(txt('pubDate')) || 0;
    const hay = title + ' ' + desc;
    return {
      title, source, at, link: txt('link'), cat: feed.cat, region: feed.region,
      desc: desc && desc !== title ? desc : '',
      themes: THEMES.filter((t) => t.re.test(hay)).map((t) => t.id),
    };
  });
}

export async function loadNews() {
  const res = await Promise.allSettled(
    FEEDS.map(async (f) => parse(await get(f.url, { ttl: 600, type: 'text' }), f)),
  );
  const seen = new Set();
  const items = [];
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    for (const it of r.value) {
      const key = it.title.toLowerCase().slice(0, 60);
      if (!it.title || !it.link || seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  }
  if (!items.length) throw new Error('Aucun flux d’actualités n’a répondu.');
  return items.sort((a, b) => b.at - a.at);
}

/** Titres de presse parus autour d'une date, pour éclairer un mouvement de cours. */
export async function causes(query, t) {
  const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const q = `${query} after:${day(t - 2 * 86400)} before:${day(t + 2 * 86400)}`;
  const items = parse(await get(gnews(q), { ttl: 3600, type: 'text' }), { name: null });
  return items.slice(0, 5);
}

export function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
