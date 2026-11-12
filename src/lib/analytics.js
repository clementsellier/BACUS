// Indicateurs, détection des mouvements marquants et projection probabiliste.
// Tout tourne en local sur l'appareil : pas de serveur, pas de bibliothèque lourde.

const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

export function logReturns(v) {
  const out = [];
  for (let k = 1; k < v.length; k++) out.push(Math.log(v[k] / v[k - 1]));
  return out;
}

export function sma(v, n) {
  if (v.length < n) return null;
  return mean(v.slice(-n));
}

export function rsi(v, n = 14) {
  if (v.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let k = 1; k <= n; k++) {
    const d = v[k] - v[k - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  for (let k = n + 1; k < v.length; k++) {
    const d = v[k] - v[k - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

/** Volatilité annualisée sur les n dernières périodes. */
export function annVol(v, ppy, n = 30) {
  const r = logReturns(v.slice(-(n + 1)));
  return r.length > 2 ? std(r) * Math.sqrt(ppy) : null;
}

export function maxDrawdown(v) {
  let peak = -Infinity, dd = 0;
  for (const x of v) {
    if (x > peak) peak = x;
    dd = Math.min(dd, x / peak - 1);
  }
  return dd;
}

/** Synthèse de tendance : score de -3 à +3 à partir des moyennes mobiles et du momentum. */
export function trend(v) {
  const last = v[v.length - 1];
  const s20 = sma(v, 20), s50 = sma(v, 50), s200 = sma(v, 200);
  let score = 0;
  if (s20 != null) score += last > s20 ? 1 : -1;
  if (s50 != null) score += last > s50 ? 1 : -1;
  if (s200 != null) score += last > s200 ? 1 : -1;
  else if (s20 != null && s50 != null) score += s20 > s50 ? 1 : -1;
  const label = score >= 2 ? 'Haussière' : score <= -2 ? 'Baissière' : 'Neutre';
  return { score, label, s20, s50, s200 };
}

/**
 * Mouvements marquants : variations dont l'ampleur dépasse z écarts-types
 * de la volatilité glissante précédente. Renvoie les `max` plus forts.
 */
export function bigMoves(points, { window = 60, z = 2, max = 6 } = {}) {
  const v = points.map((p) => p.v);
  const r = logReturns(v);
  const out = [];
  for (let k = 20; k < r.length; k++) {
    const hist = r.slice(Math.max(0, k - window), k);
    const s = std(hist);
    if (!s) continue;
    const score = Math.abs(r[k]) / s;
    if (score >= z) out.push({ t: points[k + 1].t, pct: Math.exp(r[k]) - 1, score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, max).sort((x, y) => x.t - y.t);
}

// Générateur pseudo-aléatoire déterministe : la même série donne la même projection.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/**
 * Projection par bootstrap par blocs des rendements historiques.
 *  - les rendements passés sont ré-échantillonnés par blocs (conserve les grappes de volatilité
 *    et les queues épaisses, contrairement à une loi normale) ;
 *  - la volatilité part du niveau récent (EWMA) et revient vers sa moyenne de long terme ;
 *  - la dérive est fortement réduite vers zéro : la tendance passée prédit mal la tendance future.
 * Renvoie la médiane et l'intervalle 10 %–90 % pour chaque pas de l'horizon.
 */
export function forecast(values, { horizon, paths = 800, block = 5 } = {}) {
  const r = logReturns(values.slice(-520));
  if (r.length < 40) return null;
  const mu = mean(r);
  const sHist = std(r) || 1e-9;
  let ewma = sHist ** 2;
  for (const x of r.slice(-120)) ewma = 0.94 * ewma + 0.06 * (x - mu) ** 2;
  const drift = 0.3 * mu;
  const centered = r.map((x) => x - mu);
  const scale = [];
  for (let k = 0; k < horizon; k++) {
    const varK = sHist ** 2 + (ewma - sHist ** 2) * 0.97 ** k;
    scale.push(Math.sqrt(Math.max(varK, 1e-12)) / sHist);
  }
  const rand = rng(Math.round(values[values.length - 1] * 1000) + r.length * 7919 + horizon);
  const cum = Array.from({ length: horizon }, () => new Float64Array(paths));
  for (let p = 0; p < paths; p++) {
    let acc = 0, idx = 0, left = 0;
    for (let k = 0; k < horizon; k++) {
      if (left === 0) {
        idx = Math.floor(rand() * centered.length);
        left = block;
      }
      acc += drift + centered[idx % centered.length] * scale[k];
      idx++; left--;
      cum[k][p] = acc;
    }
  }
  const last = values[values.length - 1];
  const lo = [], med = [], hi = [];
  for (let k = 0; k < horizon; k++) {
    const s = Array.from(cum[k]).sort((x, y) => x - y);
    lo.push(last * Math.exp(quantile(s, 0.1)));
    med.push(last * Math.exp(quantile(s, 0.5)));
    hi.push(last * Math.exp(quantile(s, 0.9)));
  }
  const end = cum[horizon - 1];
  let up = 0;
  for (let p = 0; p < paths; p++) if (end[p] > 0) up++;
  return { lo, med, hi, pUp: up / paths, last };
}

/**
 * Contrôle a posteriori : on rejoue la projection à des dates passées et on regarde
 * si le cours réel est bien tombé dans l'intervalle annoncé (cible : 80 %).
 */
export function backtest(values, { horizon, block = 5 } = {}) {
  const minHist = Math.max(120, Math.floor(values.length * 0.4));
  const step = Math.max(Math.floor(horizon / 2), 3);
  let n = 0, inside = 0, absErr = 0;
  for (let o = minHist; o + horizon < values.length; o += step) {
    const f = forecast(values.slice(0, o + 1), { horizon, paths: 200, block });
    if (!f) continue;
    const real = values[o + horizon];
    n++;
    if (real >= f.lo[horizon - 1] && real <= f.hi[horizon - 1]) inside++;
    absErr += Math.abs(real / f.med[horizon - 1] - 1);
  }
  if (n < 6) return null;
  return { n, coverage: inside / n, mae: absErr / n };
}

/** Pouls du marché : synthèse 0–100 à partir de la part d'actifs en hausse et du VIX. */
export function pulse(changes, vix) {
  const ok = changes.filter((c) => Number.isFinite(c));
  if (!ok.length) return null;
  const breadth = ok.filter((c) => c > 0).length / ok.length;
  const avg = mean(ok);
  let score = 50 + (breadth - 0.5) * 60 + Math.max(-20, Math.min(20, avg * 400));
  if (Number.isFinite(vix)) score -= Math.max(-8, Math.min(20, (vix - 18) * 1.4));
  score = Math.max(0, Math.min(100, score));
  const label =
    score >= 70 ? 'Optimisme' : score >= 55 ? 'Plutôt confiant' : score >= 45 ? 'Indécis' : score >= 30 ? 'Prudence' : 'Tension';
  return { score, label, breadth, avg, up: ok.filter((c) => c > 0).length, total: ok.length };
}

// ---------------------------------------------------------------------------
// Comparaison entre actifs : alignement des calendriers, corrélations, chocs
// ---------------------------------------------------------------------------

export const dayOf = (t) => Math.floor(t / 86400);

/**
 * Aligne plusieurs séries sur un calendrier commun (les marchés n'ont ni les mêmes jours fériés
 * ni les mêmes week-ends). Les trous sont comblés par la dernière valeur connue.
 * Renvoie { days, cols } où cols[k][i] est la valeur de la série k au jour days[i].
 */
export function align(list) {
  if (!list.length || list.some((s) => !s.length)) return { days: [], cols: list.map(() => []) };
  const start = Math.max(...list.map((s) => dayOf(s[0].t)));
  const set = new Set();
  for (const s of list) for (const p of s) if (dayOf(p.t) >= start) set.add(dayOf(p.t));
  const days = [...set].sort((a, b) => a - b);
  const cols = list.map((s) => {
    const col = new Array(days.length);
    let j = 0;
    for (let i = 0; i < days.length; i++) {
      while (j + 1 < s.length && dayOf(s[j + 1].t) <= days[i]) j++;
      col[i] = s[j].v;
    }
    return col;
  });
  return { days, cols };
}

/** Rendements hebdomadaires : gomme les décalages horaires entre places boursières. */
export function weeklyReturns(days, col) {
  const last = [];
  let week = null;
  for (let i = 0; i < days.length; i++) {
    const w = Math.floor((days[i] + 3) / 7);
    if (w !== week) last.push(col[i]);
    else last[last.length - 1] = col[i];
    week = w;
  }
  return logReturns(last);
}

export function corr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 8) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Corrélations d'une série avec plusieurs autres, sur rendements hebdomadaires. */
export function correlations(target, others) {
  return others.map((o) => {
    const { days, cols } = align([target, o]);
    return corr(weeklyReturns(days, cols[0]), weeklyReturns(days, cols[1]));
  });
}

export function corrMatrix(list) {
  const { days, cols } = align(list);
  const w = cols.map((c) => weeklyReturns(days, c));
  return w.map((a, i) => w.map((b, j) => (i === j ? 1 : corr(a, b))));
}

/**
 * Réaction d'un actif à un événement daté : variation le jour même, puis à 5 et 20 séances,
 * toujours mesurée depuis la clôture précédant l'événement.
 * unit : 'pct' (variation relative), 'pts' (écart en points) ou 'bp' (écart en points de base).
 */
export function reaction(pts, day, unit = 'pct') {
  const i = pts.findIndex((p) => dayOf(p.t) >= day);
  if (i < 1 || dayOf(pts[i].t) - day > 4) return null;
  const base = pts[i - 1].v;
  const at = (k) => {
    if (i + k >= pts.length) return null;
    const v = pts[i + k].v;
    return unit === 'pct' ? v / base - 1 : unit === 'bp' ? (v - base) * 100 : v - base;
  };
  return { d0: at(0), d5: at(5), d20: at(20) };
}

/** Mensualité d'un prêt à taux fixe pour 1 unité empruntée (taux annuel en %, durée en années). */
export function annuity(ratePct, years) {
  const r = ratePct / 1200, n = years * 12;
  return r === 0 ? 1 / n : r / (1 - (1 + r) ** -n);
}

// ---------------------------------------------------------------------------
// Portefeuille
// ---------------------------------------------------------------------------

/**
 * Analyse d'un portefeuille. rows : [{ qty, pts (devise d'affichage), local (devise de cotation) }].
 * `since` = timestamp de début de la période étudiée.
 * Sépare ce qui vient des actifs eux-mêmes de ce qui vient des taux de change.
 */
export function portfolio(rows, since) {
  const n = rows.length;
  const { days, cols } = align([...rows.map((r) => r.pts), ...rows.map((r) => r.local)]);
  if (days.length < 3) return null;
  const conv = cols.slice(0, n), local = cols.slice(n);
  const end = days.length - 1;
  let s = days.findIndex((d) => d >= dayOf(since));
  if (s < 0 || s >= end) s = Math.max(0, end - 1);

  const value = days.map((_, i) => rows.reduce((acc, r, k) => acc + r.qty * conv[k][i], 0));
  // Valeur finale si les taux de change étaient restés ceux du début de période
  const frozen = rows.reduce((acc, r, k) => acc + r.qty * local[k][end] * (conv[k][s] / local[k][s]), 0);
  const total = value[end], start = value[s];
  const change = total / start - 1;
  const assetEffect = frozen / start - 1;

  const lines = rows.map((r, k) => ({
    value: r.qty * conv[k][end],
    weight: (r.qty * conv[k][end]) / total,
    change: conv[k][end] / conv[k][s] - 1,
    localChange: local[k][end] / local[k][s] - 1,
    contribution: (r.qty * (conv[k][end] - conv[k][s])) / start,
    price: conv[k][end],
    localPrice: local[k][end],
  }));

  // Risque sur l'historique disponible, à composition constante
  const rets = [];
  for (let i = 1; i < value.length; i++) rets.push(value[i] / value[i - 1] - 1);
  const years = (days[end] - days[0]) / 365.25 || 1;
  const vol = std(rets) * Math.sqrt(rets.length / years);
  const worstDay = Math.min(...rets);
  const worstAt = days[rets.indexOf(worstDay) + 1] * 86400;

  // Diversification : corrélation moyenne pondérée entre lignes, et nombre « effectif » de lignes
  const w = conv.map((c) => weeklyReturns(days, c));
  let num = 0, den = 0;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const c = corr(w[a], w[b]);
      if (c == null) continue;
      num += lines[a].weight * lines[b].weight * c;
      den += lines[a].weight * lines[b].weight;
    }
  return {
    total, change, assetEffect, fxEffect: change - assetEffect, lines,
    series: days.map((d, i) => ({ t: d * 86400, v: value[i] })),
    startT: days[s] * 86400,
    vol, worstDay, worstAt, drawdown: maxDrawdown(value),
    avgCorr: den ? num / den : null,
    effective: 1 / lines.reduce((acc, l) => acc + l.weight ** 2, 0),
  };
}
