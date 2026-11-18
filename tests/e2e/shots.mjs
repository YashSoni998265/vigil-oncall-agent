// Visual check: console idle → investigating → ringing, at desktop and phone widths.
import puppeteer from 'puppeteer-core';
const OUT = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const errors = [];
for (const [name, w, h, dpr] of [['desktop', 1440, 960, 1], ['mobile', 390, 844, 2]]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${String(e).slice(0, 160)}`));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(BASE + '/console', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[data-testid=break-bad_deploy]', { timeout: 30000 });
  await sleep(800);
  await page.screenshot({ path: `${OUT}/console-${name}-idle.png`, fullPage: name === 'desktop' });
  await page.click('[data-testid=break-bad_deploy]');
  await sleep(1600);
  await page.screenshot({ path: `${OUT}/console-${name}-investigating.png`, fullPage: false });
  await page.waitForSelector('[data-testid=incoming-call]', { timeout: 15000 });
  await sleep(600);
  await page.screenshot({ path: `${OUT}/console-${name}-ringing.png`, fullPage: name === 'desktop' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, 'horizontal overflow px:', overflow);
  await ctx.close();
}
console.log('errors:', JSON.stringify(errors.slice(0, 10)));
await browser.close();
