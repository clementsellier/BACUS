<script>
  import { createChart, LineSeries, ColorType, LineStyle } from 'lightweight-charts';
  import { settings } from '../lib/state.svelte.js';

  // lines : [{ label, color (variable CSS, ex. '--c1'), points: [{t, v}], dashed }]
  let { lines, precision = 1 } = $props();
  let el;

  $effect(() => {
    settings.theme;
    if (!el || !lines?.some((l) => l.points.length)) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: c('--muted'), fontFamily: 'system-ui, sans-serif', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: c('--border') } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: c('--surface-2') }, vertLine: { labelBackgroundColor: c('--surface-2') } },
      localization: { locale: 'fr-FR' },
      handleScale: { axisPressedMouseMove: false, mouseWheel: false },
      handleScroll: { mouseWheel: false, vertTouchDrag: false },
    });
    for (const l of lines) {
      const s = chart.addSeries(LineSeries, {
        color: c(l.color), lineWidth: 2, lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false, priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision },
      });
      const data = [];
      for (const p of l.points) if (!data.length || p.t > data[data.length - 1].time) data.push({ time: p.t, value: p.v });
      s.setData(data);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  });
</script>

<div class="chart" bind:this={el}></div>
<div class="legend" style="padding:6px 10px 4px">
  {#each lines as l}
    <span><i class:dash={l.dashed} style="color:var({l.color})"></i>{l.label}</span>
  {/each}
</div>
