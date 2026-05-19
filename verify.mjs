// Optional smoke test. Requires `npm i -D playwright` (or set PLAYWRIGHT_PATH).
// Start the dev server first: `npm run dev` (in another terminal), then `node verify.mjs`.
const pwPath = process.env.PLAYWRIGHT_PATH ?? 'playwright';
const { chromium } = await import(pwPath);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (msg) => {
  const t = msg.text();
  if (t.startsWith('[v]')) console.log(`BROWSER: ${t}`);
});

await page.goto('http://localhost:5200/fundraisers/1');
await page.waitForSelector('[data-testid="label"]');

const before = await page.locator('[data-testid="label"]').textContent();
console.log('BEFORE click, label =', JSON.stringify(before));

await page.waitForLoadState('networkidle');
await page.click('button:has-text("Mark reviewed")');
await page.waitForURL('**/2');

const samples = [];
const start = Date.now();
for (let i = 0; i < 60; i++) {
  const v = await page.locator('[data-testid="label"]').textContent();
  samples.push({ t: Date.now() - start, v });
  if (i < 59) await page.waitForTimeout(50);
}
let last = null;
for (const s of samples) {
  if (s.v !== last) {
    console.log(`+${s.t}ms label =`, JSON.stringify(s.v));
    last = s.v;
  }
}
const at_3s = samples[samples.length - 1].v;

await browser.close();

const expected = 'LABEL for id=2';
if (at_3s.includes(expected)) {
  console.log('\nNOT REPRODUCED: label updated to the new value.');
  process.exit(0);
} else {
  console.log(`\nREPRODUCED: label stuck at ${JSON.stringify(at_3s)}, expected to contain ${JSON.stringify(expected)}`);
  process.exit(1);
}
