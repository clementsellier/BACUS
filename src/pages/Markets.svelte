<script>
  import Stocks from './Stocks.svelte';
  import Crypto from './Crypto.svelte';
  import RealEstate from './RealEstate.svelte';
  import { ui } from '../lib/state.svelte.js';

  const SUBS = [
    { id: 'stocks', label: 'Actions', page: Stocks },
    { id: 'crypto', label: 'Crypto', page: Crypto },
    { id: 'realestate', label: 'Immobilier', page: RealEstate },
  ];
  const Sub = $derived(SUBS.find((s) => s.id === ui.market).page);
</script>

<div class="seg wide">
  {#each SUBS as s}
    <button class:on={ui.market === s.id} onclick={() => (ui.market = s.id)}>{s.label}</button>
  {/each}
</div>

<Sub />
