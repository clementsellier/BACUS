import { Capacitor } from '@capacitor/core';

const native = Capacitor.isNativePlatform();

/** En natif (APK) on appelle l'URL directement ; dans un navigateur on passe par le relais local. */
export function px(url) {
  return native ? url : '/px/' + url.replace(/^https:\/\//, '');
}

const cache = new Map();
const pending = new Map();

/** fetch avec cache mémoire (ttl en secondes) et dé-duplication des requêtes en cours. */
export async function get(url, { ttl = 300, type = 'json' } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl * 1000) return hit.data;
  if (pending.has(url)) return pending.get(url);
  const p = (async () => {
    try {
      const r = await fetch(px(url));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = type === 'json' ? await r.json() : await r.text();
      cache.set(url, { at: Date.now(), data });
      return data;
    } catch (e) {
      if (hit) return hit.data; // données périmées plutôt que rien
      throw e;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, p);
  return p;
}

export function clearCache() {
  cache.clear();
}
