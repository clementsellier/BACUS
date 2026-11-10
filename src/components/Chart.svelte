<script>
  import { createChart, AreaSeries, LineSeries, LineStyle, ColorType, createSeriesMarkers } from 'lightweight-charts';
  import { settings } from '../lib/state.svelte.js';
  import { pct } from '../lib/format.js';

  // points : [{t, v}] — fc : {times, lo, med, hi} — markers : [{t, pct}]
  let { points, fc = null, markers = [], intraday = false, rising = true } = $props();
  let el;

  const uniq = (arr) => {
    const out = [];
    for (const p of arr) if (!out.length || p.time > out[out.length - 1].time) out.push(p);
    return out;
  };

  $effect(() => {
    settings.theme; // redessine au changement de thème
    if (!el || !points?.length) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const main = rising ? c('--up') : c('--down');
    const last = points[points.length - 1].v;
    const precision = last >= 100 ? 2 : last >= 1 ? 3 : last >= 0.01 ? 5 : 8;
    const priceFormat = { type: 'price', precision, minMove: 1 / 10 ** precision };

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: c('--muted'), fontFamily: 'system-ui, sans-serif', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: c('--border') } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: c('--surface-2') }, vertLine: { labelBackgroundColor: c('--surface-2') } },
      localization: { locale: 'fr-FR' },
      handleScale: { axisPressedMouseMove: false, mouseWheel: false },
      handleScroll: { mouseWheel: false, vertTouchDrag: false },
    });

    const area = chart.addSeries(AreaSeries, {
      lineColor: main, lineWidth: 2, priceFormat,
      topColor: main + '55', bottomColor: main + '00',
      priceLineVisible: false,
    });
    area.setData(uniq(points.map((p) => ({ time: p.t, value: p.v }))));

    if (markers.length) {
      createSeriesMarkers(
        area,
        markers.map((m) => ({
          time: m.t,
          position: m.pct > 0 ? 'aboveBar' : 'belowBar',
          shape: 'circle',
          color: m.pct > 0 ? c('--up') : c('--down'),
          text: pct(m.pct, 1),
        })),
      );
    }

    if (fc) {
      const t0 = points[points.length - 1].t;
      const line = (vals, color, style, width) => {
        const s = chart.addSeries(LineSeries, {
          color, lineStyle: style, lineWidth: width, priceFormat,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        });
        s.setData(uniq([{ time: t0, value: last }, ...vals.map((v, k) => ({ time: fc.times[k], value: v }))]));
      };
      line(fc.hi, c('--muted'), LineStyle.Dotted, 1);
      line(fc.lo, c('--muted'), LineStyle.Dotted, 1);
      line(fc.med, c('--accent'), LineStyle.Dashed, 2);
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  });
</script>

<div class="chart" bind:this={el}></div>
