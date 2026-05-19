# DOM reverts to pre-navigation render when same-route `goto({invalidateAll: true})` runs while a `$state`-bound attribute toggles around the await

## Versions

Verified on the latest of everything as of 2026-05-19:

- `svelte`: 5.55.8
- `@sveltejs/kit`: 2.60.1
- `vite`: 8.0.13
- `@sveltejs/vite-plugin-svelte`: 7.1.2

Also reproduces with `vite@5.4.21` + `@sveltejs/vite-plugin-svelte@4.0.4` and across the svelte/kit version pairs in between — Vite version doesn't matter.

## Configuration

```js
// svelte.config.js
export default {
  compilerOptions: {
    experimental: { async: true }
  },
  // ...
};
```

## Symptom

After clicking a button that performs `goto('/new', { invalidateAll: true })` to the same parameterized route (`/fundraisers/[id]`), the URL advances and reactive state updates to the new `data` (verified via `$inspect` / `$effect`), and the DOM briefly renders the new content. Then, within ~50 ms, the DOM is rolled back to the previous render and stays there. No further reactivity recovers it.

```
BEFORE click,                  label = "LABEL for id=1"
+4ms after URL change,         label = "LABEL for id=2"   ← correct, briefly
+57ms,                         label = "LABEL for id=1"   ← reverted
+3s,                           label = "LABEL for id=1"   ← stays reverted
```

## Reproduction

Full minimal repro (8 files). With these files, click the button on `/fundraisers/1` — the URL becomes `/fundraisers/2` but the visible label stays `"LABEL for id=1"`.

### `package.json`
```json
{
  "name": "repro",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite dev" },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^7.0.1",
    "@sveltejs/kit": "^2.60.1",
    "@sveltejs/vite-plugin-svelte": "^7.1.2",
    "svelte": "^5.55.8",
    "vite": "^8.0.13"
  }
}
```

### `svelte.config.js`
```js
import adapter from '@sveltejs/adapter-auto';
export default {
  compilerOptions: { experimental: { async: true } },
  kit: { adapter: adapter() }
};
```

### `src/routes/fundraisers/[id]/+page.server.js`
```js
export function load({ params }) {
  const id = Number(params.id);
  return {
    fundraiser: { id, needsReview: `LABEL for id=${id}` },
    updates: [{ id: id * 100 }]
  };
}
```

### `src/routes/fundraisers/[id]/+page.svelte`
```svelte
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
  <button type="button" {onclick} disabled={markingReviewed}>next</button>
{/key}

<Scroller items={updates} />
```

### `src/routes/fundraisers/[id]/Scroller.svelte`
```svelte
<script>
  import Slow from './Slow.svelte';
  let { items } = $props();
</script>

{#each items as item (item.id)}
  <Slow id={item.id} />
{/each}
```

### `src/routes/fundraisers/[id]/Slow.svelte`
```svelte
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
```

## Trigger set (all required to reproduce)

Each of these was individually bisected; removing **any** of them masks the bug:

1. `compilerOptions.experimental.async: true`.
2. Same-route `goto(url, { invalidateAll: true })` where the URL changes a route param.
3. A click handler that mutates a `$state` to `true` *before* `await goto(...)`, and back to `false` in a `finally` block *after* it resolves.
4. A DOM attribute bound to that `$state` (e.g. `disabled={markingReviewed}`) **on an element inside a `{#key}` block** whose key expression also depends on the per-route data.
5. Elsewhere on the page: a child component rendered via `{#each}` that contains a `<svelte:boundary>` with a top-level `await` (the awaited promise can reject; behavior is the same on `pending → failed`).

Notable details:
- Inlining the `<svelte:boundary>` directly into `+page.svelte` (no child component) does **not** reproduce — it must be one component deep.
- Replacing the click handler with a `<form action="?/x" use:enhance>` that runs the same logic reproduces too.
- Removing the `{#key}` block — even keeping the `disabled={markingReviewed}` button — does not reproduce.
- Removing `disabled={markingReviewed}` while keeping the `{#key}` block does not reproduce.
- Hover preload (`data-sveltekit-preload-data="hover"`) is **not** needed (this distinguishes it from sveltejs/kit#14923, which has a similar "flash then revert" signature but different trigger).
- A `$effect` reading the post-navigation state fires correctly with the *new* value at the moment of the revert, so reactivity itself isn't broken — only DOM commit is rolling back.

## What I think is happening

This looks like Svelte 5 async-coherence is treating the new render as not-yet-coherent because the new boundary's pending `await` is still in flight, and rolling the DOM back to the "previous coherent state" — but it never advances forward again after the boundary settles (`failed` snippet renders in the boundary fine; the parent DOM stays at the previous render).

The `disabled={markingReviewed}` binding seems to be what wires the click handler's await into the same coherence frame as the navigation, since removing it (or hoisting it out of the `{#key}` block) breaks the trigger. I suspect `{#key}` participates because it forces the new render to be a fresh subtree rather than a structural diff.

## Related (but distinct) issues

- sveltejs/kit#14923 — same "flash then revert" symptom, different trigger (cross-route + preload + conditional `bind:this` in a layout). Workaround there is disabling `data-sveltekit-preload-data`; that doesn't apply here.
- sveltejs/kit#14798 — stale reactive function calls during async client-side nav.
- sveltejs/svelte#17197 / PR #17581 — hover-preload reactivity loss (fixed); a separate failure mode.
