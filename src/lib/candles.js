// Figures en chandeliers japonais : repérage des figures classiques sur des bougies {t, o, h, l, c},
// puis mesure honnête de ce qui s'est passé après chacune d'elles dans l'historique de l'actif.

// dir : 1 = signal de hausse attendu, −1 = de baisse, 0 = indécision.
export const PATTERNS = {
  hammer: { label: 'Marteau', dir: 1, text: 'Après une baisse, le cours a nettement plongé pendant la séance, puis les acheteurs l’ont ramené près du plus haut. Signal possible de rebond.' },
  invhammer: { label: 'Marteau inversé', dir: 1, text: 'Après une baisse, les acheteurs ont tenté une remontée pendant la séance sans la tenir jusqu’au bout. Signal de rebond à confirmer.' },
  bullEngulf: { label: 'Avalement haussier', dir: 1, text: 'Une bougie de hausse « avale » entièrement la bougie de baisse de la veille : les acheteurs reprennent la main.' },
  piercing: { label: 'Ligne pénétrante', dir: 1, text: 'Après une forte séance de baisse, le cours ouvre bas mais remonte au-delà de la moitié de la bougie précédente.' },
  morningStar: { label: 'Étoile du matin', dir: 1, text: 'Trois séances : une forte baisse, une séance hésitante, puis une forte hausse. Figure classique de retournement à la hausse.' },
  soldiers: { label: 'Trois soldats blancs', dir: 1, text: 'Trois fortes séances de hausse d’affilée, chacune clôturant plus haut : élan acheteur soutenu.' },
  hanging: { label: 'Pendu', dir: -1, text: 'Même forme que le marteau, mais après une hausse : les vendeurs ont réussi à faire chuter le cours en séance. Avertissement de repli.' },
  shooting: { label: 'Étoile filante', dir: -1, text: 'Après une hausse, le cours a grimpé pendant la séance puis a été repoussé vers le bas : les vendeurs reprennent la main.' },
  bearEngulf: { label: 'Avalement baissier', dir: -1, text: 'Une bougie de baisse « avale » entièrement la bougie de hausse de la veille : les vendeurs reprennent la main.' },
  darkCloud: { label: 'Nuage noir', dir: -1, text: 'Après une forte séance de hausse, le cours ouvre haut mais retombe sous la moitié de la bougie précédente.' },
  eveningStar: { label: 'Étoile du soir', dir: -1, text: 'Trois séances : une forte hausse, une séance hésitante, puis une forte baisse. Figure classique de retournement à la baisse.' },
  crows: { label: 'Trois corbeaux noirs', dir: -1, text: 'Trois fortes séances de baisse d’affilée, chacune clôturant plus bas : pression vendeuse soutenue.' },
  doji: { label: 'Doji', dir: 0, text: 'Ouverture et clôture presque identiques : acheteurs et vendeurs se neutralisent. Après une longue tendance, signe possible d’essoufflement.' },
};

const body = (c) => Math.abs(c.c - c.o);
const bull = (c) => c.c > c.o;
const bear = (c) => c.c < c.o;
const upper = (c) => c.h - Math.max(c.o, c.c);
const lower = (c) => Math.min(c.o, c.c) - c.l;

/**
 * Repère les figures sur toute la série. Renvoie [{ i, t, id }] où i est l'indice de la dernière bougie de la figure.
 * La tendance qui précède est mesurée sur les 5 bougies d'avant, rapportée à l'amplitude habituelle d'une séance.
 */
export function detect(cs) {
  const out = [];
  const W = 14;
  const TH = 0.3; // seuil de tendance préalable (en amplitudes de séance)
  for (let i = W + 6; i < cs.length; i++) {
    let sr = 0, sb = 0;
    for (let k = i - W; k < i; k++) {
      sr += cs[k].h - cs[k].l;
      sb += body(cs[k]);
    }
    const avgR = sr / W, avgB = sb / W;
    if (!(avgR > 0) || !(avgB > 0)) continue;
    // tendance avant la bougie j (exclue) : < −TH baisse, > TH hausse
    const prior = (j) => (cs[j - 1].c - cs[j - 6].c) / (avgR * Math.sqrt(5));
    const c = cs[i], p = cs[i - 1], q = cs[i - 2];
    const r = c.h - c.l, b = body(c);
    const found = [];
    const t1 = prior(i), t2 = prior(i - 1), t3 = prior(i - 2);

    if (r >= 0.8 * avgR && b >= 0.08 * r) {
      if (lower(c) >= 2 * b && lower(c) >= 0.55 * r && upper(c) <= 0.15 * r) {
        if (t1 < -TH) found.push('hammer');
        else if (t1 > TH) found.push('hanging');
      }
      if (upper(c) >= 2 * b && upper(c) >= 0.55 * r && lower(c) <= 0.15 * r) {
        if (t1 < -TH) found.push('invhammer');
        else if (t1 > TH) found.push('shooting');
      }
    }
    const pb = body(p);
    if (pb >= 0.3 * avgB && b > pb) {
      if (bear(p) && bull(c) && c.o <= p.c && c.c >= p.o && t2 < -TH) found.push('bullEngulf');
      if (bull(p) && bear(c) && c.o >= p.c && c.c <= p.o && t2 > TH) found.push('bearEngulf');
    }
    if (pb >= avgB) {
      const mid = (p.o + p.c) / 2;
      if (bear(p) && bull(c) && c.o <= p.c && c.c > mid && c.c < p.o && t2 < -TH) found.push('piercing');
      if (bull(p) && bear(c) && c.o >= p.c && c.c < mid && c.c > p.o && t2 > TH) found.push('darkCloud');
    }
    const qb = body(q);
    if (qb >= avgB && body(p) <= 0.35 * qb && b >= 0.5 * avgB) {
      const mid = (q.o + q.c) / 2;
      if (bear(q) && bull(c) && c.c >= mid && t3 < -TH) found.push('morningStar');
      if (bull(q) && bear(c) && c.c <= mid && t3 > TH) found.push('eveningStar');
    }
    const three = [q, p, c];
    const strong = three.every((x) => body(x) >= 0.7 * avgB && upper(x) + lower(x) <= 0.6 * (x.h - x.l));
    if (strong) {
      if (three.every(bull) && p.c > q.c && c.c > p.c && p.o >= q.o && p.o <= q.c && c.o >= p.o && c.o <= p.c) found.push('soldiers');
      if (three.every(bear) && p.c < q.c && c.c < p.c && p.o <= q.o && p.o >= q.c && c.o <= p.o && c.o >= p.c) found.push('crows');
    }
    if (!found.length && b <= 0.1 * r && r >= 0.6 * avgR && Math.abs(t1) > 1) found.push('doji');
    for (const id of found) out.push({ i, t: c.t, id });
  }
  return out;
}

/**
 * Ce qui a suivi chaque figure : part des cas où le cours était plus haut h bougies plus tard,
 * variation moyenne, comparées à une bougie quelconque de la même série (la « normale »).
 */
export function patternStats(cs, hits, h) {
  const fwd = (i) => cs[i + h].c / cs[i].c - 1;
  const n0 = cs.length - h;
  if (n0 < 30) return null;
  let up0 = 0, sum0 = 0;
  for (let i = 0; i < n0; i++) {
    const r = fwd(i);
    if (r > 0) up0++;
    sum0 += r;
  }
  const base = { n: n0, pUp: up0 / n0, mean: sum0 / n0 };
  const by = {};
  for (const x of hits) {
    if (x.i + h >= cs.length) continue;
    const s = (by[x.id] ??= { n: 0, up: 0, sum: 0 });
    const r = fwd(x.i);
    s.n++;
    if (r > 0) s.up++;
    s.sum += r;
  }
  const stats = {};
  for (const id of Object.keys(PATTERNS)) {
    const s = by[id];
    if (!s) {
      stats[id] = { n: 0 };
      continue;
    }
    const pUp = s.up / s.n;
    stats[id] = { n: s.n, pUp, mean: s.sum / s.n, ...judge(id, s.n, pUp, base.pUp) };
  }
  return { base, stats, h };
}

/** Verdict : la figure a-t-elle fait mieux que le hasard, dans le sens attendu ? (test binomial approché) */
function judge(id, n, pUp, p0) {
  if (n < 12) return { verdict: 'rare', z: null };
  const z = (pUp - p0) / Math.sqrt((p0 * (1 - p0)) / n);
  const d = PATTERNS[id].dir;
  if (d === 0) return { verdict: Math.abs(z) >= 1.65 ? (z > 0 ? 'up' : 'down') : 'noise', z };
  const aligned = d * z;
  return { verdict: aligned >= 1.65 ? 'works' : aligned <= -1.65 ? 'reverse' : 'noise', z };
}

export const VERDICTS = {
  works: { label: 'A plutôt fonctionné', cls: 'up' },
  reverse: { label: 'A plutôt donné l’inverse', cls: 'down' },
  noise: { label: 'Pas mieux que le hasard', cls: '' },
  rare: { label: 'Trop peu d’exemples', cls: '' },
  up: { label: 'Suivi plutôt de hausses', cls: 'up' },
  down: { label: 'Suivi plutôt de baisses', cls: 'down' },
};

/** Figures apparues sur les `last` dernières bougies, de la plus récente à la plus ancienne. */
export function recent(cs, hits, last = 10) {
  const from = cs.length - last;
  return hits.filter((x) => x.i >= from).sort((a, b) => b.i - a.i);
}

/** Statistiques regroupées sur plusieurs séries (scanner) : plus d'exemples, verdict plus solide. */
export function pooledStats(series, h) {
  let n0 = 0, up0 = 0, sum0 = 0;
  const by = {};
  for (const { cs, hits } of series) {
    for (let i = 0; i + h < cs.length; i++) {
      const r = cs[i + h].c / cs[i].c - 1;
      n0++;
      if (r > 0) up0++;
      sum0 += r;
    }
    for (const x of hits) {
      if (x.i + h >= cs.length) continue;
      const s = (by[x.id] ??= { n: 0, up: 0, sum: 0 });
      const r = cs[x.i + h].c / cs[x.i].c - 1;
      s.n++;
      if (r > 0) s.up++;
      s.sum += r;
    }
  }
  if (!n0) return null;
  const base = { n: n0, pUp: up0 / n0, mean: sum0 / n0 };
  const stats = {};
  for (const id of Object.keys(PATTERNS)) {
    const s = by[id];
    stats[id] = s ? { n: s.n, pUp: s.up / s.n, mean: s.sum / s.n, ...judge(id, s.n, s.up / s.n, base.pUp) } : { n: 0 };
  }
  return { base, stats, h };
}
