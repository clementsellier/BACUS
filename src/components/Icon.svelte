<script>
  let { name } = $props();
  const P = {
    overview: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z',
    stocks: 'M4 19h16M6 15l4-5 4 3 5-7',
    crypto: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l8 4.5 8-4.5',
    home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
    news: 'M5 5h11v14H5zM16 9h3v8a2 2 0 01-2 2M8 9h5M8 12.5h5M8 16h3',
    star: 'M12 4l2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8z',
    back: 'M15 5l-7 7 7 7',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M5 19l1.8-1.8M17.2 6.8L19 5',
    moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
    wallet: 'M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 7l11-3v3M16 13.5h2',
    lab: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M8 15h8',
    refresh: 'M20 12a8 8 0 11-2.6-5.9M20 4v5h-5',
  };
</script>

<svg viewBox="0 0 24 24" fill={name === 'star-fill' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={P[name === 'star-fill' ? 'star' : name]} />
</svg>
