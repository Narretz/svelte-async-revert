<script>
  import Slow from './Slow.svelte';
  let { items } = $props();
</script>

{#each items as item (item.id)}
  <Slow id={item.id} />
{/each}
