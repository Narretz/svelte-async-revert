<script>
  let { id } = $props();
  async function slowFail(forId) {
    await new Promise((r) => setTimeout(r, 50));
    throw new Error(`fail ${forId}`);
  }
</script>

<svelte:boundary>
  <pre>{await slowFail(id)}</pre>
  {#snippet pending()}<p>pending</p>{/snippet}
  {#snippet failed()}<p>failed</p>{/snippet}
</svelte:boundary>
