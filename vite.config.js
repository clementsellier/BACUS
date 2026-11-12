import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Hôtes de données autorisés. Dans l'APK, les requêtes partent en natif (pas de CORS).
// Dans un navigateur (dev / preview), elles passent par ce petit relais local.
const ALLOWED = new Set([
  'query1.finance.yahoo.com',
  'api.coingecko.com',
  'fred.stlouisfed.org',
  'data-api.ecb.europa.eu',
  'news.google.com',
  'www.lemonde.fr',
  'feeds.bbci.co.uk',
  'www.france24.com',
  'www.cnbc.com',
  'www.coindesk.com',
  'www.bfmtv.com',
  'feeds.bloomberg.com',
  'seekingalpha.com',
  'www.ft.com',
  'www.theguardian.com',
  'rss.nytimes.com',
  'rss.dw.com',
  'www.fxstreet.com',
  'oilprice.com',
  'www.federalreserve.gov',
  'www.ecb.europa.eu',
  'www.scmp.com',
  'www.aljazeera.com',
  'cointelegraph.com',
]);

function relay() {
  const handler = async (req, res, next) => {
    if (!req.url.startsWith('/px/')) return next();
    const rest = req.url.slice(4);
    const host = rest.split('/')[0];
    if (!ALLOWED.has(host)) {
      res.statusCode = 403;
      return res.end('host not allowed');
    }
    try {
      const r = await fetch('https://' + rest, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
        redirect: 'follow',
      });
      res.statusCode = r.status;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'text/plain');
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.statusCode = 502;
      res.end(String(e));
    }
  };
  return {
    name: 'bacus-relay',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  plugins: [svelte(), relay()],
  base: './',
  server: { port: 5173 },
  build: { target: 'es2020' },
});
