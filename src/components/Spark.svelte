<script>
  let { values = [], width = 76, height = 30 } = $props();
  const path = $derived.by(() => {
    if (values.length < 2) return '';
    // on limite à ~60 points : suffisant à cette taille
    const step = Math.max(1, Math.floor(values.length / 60));
    const v = values.filter((_, k) => k % step === 0 || k === values.length - 1);
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    return v
      .map((y, k) => `${k ? 'L' : 'M'}${((k / (v.length - 1)) * width).toFixed(1)},${(height - 2 - ((y - min) / span) * (height - 4)).toFixed(1)}`)
      .join('');
  });
  const up = $derived(values.length > 1 && values[values.length - 1] >= values[0]);
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
  <path d={path} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
</svg>
