const nf = (opts) => new Intl.NumberFormat('fr-FR', opts);

export function price(v, cur) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  if (cur) {
    try {
      return nf({ style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    } catch {
      /* devise inconnue d'Intl : on retombe sur le format simple */
    }
  }
  return nf({ minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits }).format(v) + (cur ? ' ' + cur : '');
}

export function pct(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v) * 100);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + s + ' %';
}

export function compact(v, cur) {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf({ notation: 'compact', maximumFractionDigits: 1, ...(cur ? { style: 'currency', currency: cur } : {}) }).format(v);
}

export const dir = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

export function date(t, withYear = true) {
  return new Date(t * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
}
