# svelte-async-revert-repro

Minimal reproduction for the "DOM reverts to pre-navigation render" bug in Svelte 5
async mode + SvelteKit. See `ISSUE.md` for the full write-up to paste into a GitHub
issue.

## Run

```
npm ci
npm run dev          # opens on :5173 by default
```

Open http://localhost:5173/fundraisers/1 and click "Mark reviewed and go to next".

**Expected:** label becomes `LABEL for id=2`.
**Actual:** label briefly shows `LABEL for id=2` (~5 ms), then reverts to `LABEL for id=1` and stays there. The URL is `/fundraisers/2` and reactive state has the new value, but the DOM doesn't.

## Automated check (optional)

Start the dev server on port 5200 (`npm run dev -- --port 5200`), then in another
terminal:

```
npm i -D playwright
node verify.mjs
```

It samples `.label` every 50 ms for 3 s and exits 1 if the value is stuck.
