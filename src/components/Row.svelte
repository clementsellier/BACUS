<script>
  import Spark from './Spark.svelte';
  import { pct, dir } from '../lib/format.js';
  let { name, sub = '', avatar = '', image = '', flag = false, priceText, change, spark = [], extra = '', onclick } = $props();
</script>

<button class="row" {onclick}>
  <span class="avatar" class:flag>
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
