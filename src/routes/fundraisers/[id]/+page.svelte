<script>
  import { goto } from '$app/navigation';
  import Scroller from './Scroller.svelte';

  let { data } = $props();

  let markingReviewed = $state(false);

  const fundraiser = $derived(data.fundraiser);
  const updates = $derived(data.updates);

  async function onclick() {
    markingReviewed = true;
    try {
      await goto(`/fundraisers/${fundraiser.id + 1}`, { invalidateAll: true });
    } finally {
      markingReviewed = false;
    }
  }
</script>

{#key fundraiser.id}
  <p data-testid="label">{fundraiser.needsReview}</p>
  <button type="button" {onclick} disabled={markingReviewed}>Mark reviewed and go to next</button>
{/key}

<Scroller items={updates} />
