// Generuje PNG z grafiki.html:  node social/render.mjs  (wymaga Playwright)
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const names = { avatar: '1-zdjecie-profilowe', cover: '2-okladka-facebook', p1: '3-post-powitalny', p2: '4-post-okazje', p3: '5-post-przyjaciolki', p4: '6-post-cennik', story: '7-story-quiz' };
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
await p.goto('file://' + dir + 'grafiki.html');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
for (const [id, n] of Object.entries(names)) await p.locator('#' + id).screenshot({ path: `${dir}grafiki/${n}.png` });
await b.close();
console.log('OK');
