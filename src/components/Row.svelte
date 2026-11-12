<script>
  import Spark from './Spark.svelte';
  import { pct, dir } from '../lib/format.js';
  let { name, sub = '', avatar = '', image = '', flag = false, priceText, change, spark = [], extra = '', onclick } = $props();
  // Teinte stable par actif : on reconnaît une ligne à sa couleur d'un écran à l'autre.
  const hue = $derived([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7));
</script>

<button class="row" {onclick}>
  <span class="avatar" class:flag style={image || flag ? '' : `background:hsl(${hue} 55% 50% / 0.16);color:color-mix(in srgb, hsl(${hue} 70% 50%) 72%, var(--text))`}>
    {#if image}<img src={image} alt="" loading="lazy" />{:else}{avatar}{/if}
  </span>
  <span style="min-width:0">
    <span class="name" style="display:block">{name}</span>
    <span class="sub" style="display:block">{sub}</span>
  </span>
  <Spark values={spark} />
  <span class="vals num">
    <span class="p" style="display:block">{priceText}</span>
    <span class="badge {dir(change)}">{pct(change)}</span>
    {#if extra}<span class="sub" style="display:block">{extra}</span>{/if}
  </span>
</button>
