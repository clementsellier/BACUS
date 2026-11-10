<script>
  let { options, value = $bindable(), label = '' } = $props();
</script>

<div class="chips" role="group" aria-label={label}>
  {#each options as o (o.id)}
    <button class="chip" class:on={value === o.id} onclick={() => (value = o.id)}>{o.label}</button>
  {/each}
</div>
