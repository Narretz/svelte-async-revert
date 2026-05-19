<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  onMount(() => goto('/fundraisers/1', { replaceState: true }));
</script>

<p><a href="/fundraisers/1">go to /fundraisers/1</a></p>
