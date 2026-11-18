// README screenshots from a finished sandbox (no Agora minutes used).
import puppeteer from 'puppeteer-core';
import path from 'node:path';
const [, , sandbox] = process.argv;
const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../docs/screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio'] });
async function shot(url, file, { w = 1440, h = 900, full = false, wait = 2500, scrollReveal = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.goto(BASE + url, { waitUntil: 'networkidle2' });
  if (scrollReveal) await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible')));
  await sleep(wait);
  await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  await page.close();
  console.log('saved', file);
}
await shot(`/console?s=${sandbox}`, 'console-incident.png', { h: 1000 });
await shot(`/postmortem?s=${sandbox}`, 'postmortem.png', { w: 1100, h: 1300 });
await shot(`/status?s=${sandbox}`, 'status-page.png', { w: 1100, h: 1100 });
await shot('/', 'landing-hero.png', { h: 1000, scrollReveal: true, wait: 13000 });
await browser.close();
