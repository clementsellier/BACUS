<script>
  // segments : [{ label, value, color (variable CSS) }]
  let { segments, title = '' } = $props();
  const R = 42, C = 2 * Math.PI * R;
  const total = $derived(segments.reduce((s, x) => s + x.value, 0) || 1);
  const arcs = $derived.by(() => {
    let acc = 0;
    return segments.map((s) => {
      const len = (s.value / total) * C;
      const a = { ...s, len, offset: -acc, share: s.value / total };
      acc += len;
      return a;
    });
  });
</script>

<div class="donut">
  <svg viewBox="0 0 100 100" width="118" height="118" role="img" aria-label={title}>
    <g transform="rotate(-90 50 50)">
      {#each arcs as a}
        <circle cx="50" cy="50" r={R} fill="none" stroke="var({a.color})" stroke-width="13"
          stroke-dasharray="{Math.max(a.len - 1.2, 0.5)} {C}" stroke-dashoffset={a.offset} />
      {/each}
    </g>
  </svg>
  <div class="donut-legend">
    {#if title}<div class="k">{title}</div>{/if}
    {#each arcs as a}
      <div class="donut-row">
        <span class="dot" style="background:var({a.color})"></span>
        <span style="flex:1">{a.label}</span>
        <b class="num">{(a.share * 100).toFixed(0)} %</b>
      </div>
    {/each}
  </div>
</div>
