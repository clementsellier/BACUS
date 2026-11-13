<script>
  import { createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle, ColorType, createSeriesMarkers } from 'lightweight-charts';
  import { settings } from '../lib/state.svelte.js';

  // candles : [{t, o, h, l, c, v}] — marks : [{t, dir, label}] — fc : {times, lo, med, hi}
  let { candles, marks = [], fc = null, intraday = false } = $props();
  let el;

  const uniq = (arr) => {
    const out = [];
    for (const p of arr) if (!out.length || p.time > out[out.length - 1].time) out.push(p);
    return out;
  };

  $effect(() => {
    settings.theme; // redessine au changement de thème
    if (!el || !candles?.length) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const up = c('--up'), down = c('--down');
    const last = candles[candles.length - 1].c;
    const precision = last >= 100 ? 2 : last >= 1 ? 3 : last >= 0.01 ? 5 : 8;
    const priceFormat = { type: 'price', precision, minMove: 1 / 10 ** precision };

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: c('--muted'), fontFamily: 'system-ui, sans-serif', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: c('--border') } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: c('--surface-2') }, vertLine: { labelBackgroundColor: c('--surface-2') } },
      localization: { locale: 'fr-FR' },
      handleScale: { axisPressedMouseMove: false, mouseWheel: false },
      handleScroll: { mouseWheel: false, vertTouchDrag: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
      priceFormat, priceLineVisible: false,
    });
    series.setData(uniq(candles.map((k) => ({ time: k.t, open: k.o, high: k.h, low: k.l, close: k.c }))));

    // Volume en bas du graphique (absent pour les indices et les devises)
    if (candles.some((k) => k.v > 0)) {
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(uniq(candles.map((k) => ({ time: k.t, value: k.v, color: (k.c >= k.o ? up : down) + '55' }))));
    }

    if (marks.length) {
      createSeriesMarkers(
        series,
        [...marks].sort((a, b) => a.t - b.t).map((m) => ({
          time: m.t,
          position: m.dir > 0 ? 'belowBar' : m.dir < 0 ? 'aboveBar' : 'aboveBar',
          shape: m.dir > 0 ? 'arrowUp' : m.dir < 0 ? 'arrowDown' : 'circle',
          color: m.dir > 0 ? up : m.dir < 0 ? down : c('--muted'),
          text: m.label ?? '',
        })),
      );
    }

    if (fc) {
      const t0 = candles[candles.length - 1].t;
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
