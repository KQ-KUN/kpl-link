import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serveRoots } from './local-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.KPL_PLAYWRIGHT_PATH || 'playwright');
const baselineArg = process.argv[process.argv.indexOf('--baseline') + 1];
if (!process.argv.includes('--baseline') || !baselineArg) throw Error('Provide --baseline <frozen Link dist directory> explicitly');
const baseline = path.resolve(baselineArg);
await fs.mkdir(path.join(root, 'reports'), { recursive: true });
const server = await serveRoots({ before: baseline, after: path.join(root, 'dist') });
const browser = await chromium.launch({ ...(process.env.KPL_BROWSER_CHANNEL ? { channel: process.env.KPL_BROWSER_CHANNEL } : {}), headless: true });
const report = { browser: browser.version(), environment: 'local static HTTP, cacheable responses, no artificial throttling; bytes/timings from browser', runs: [], checks: [], pageErrors: [], blocked: [] };
const measure = page => page.evaluate(() => ({ domElements: document.querySelectorAll('*').length,
  requests: performance.getEntriesByType('resource').length,
  transferBytes: performance.getEntriesByType('resource').reduce((sum, item) => sum + item.transferSize, 0),
  encodedBytes: performance.getEntriesByType('resource').reduce((sum, item) => sum + item.encodedBodySize, 0),
  durationMs: performance.now(), dataResources: performance.getEntriesByType('resource').filter(item => item.name.includes('/data/')).map(item => ({ name: new URL(item.name).pathname, duration: item.duration, transferSize: item.transferSize, encodedBodySize: item.encodedBodySize })) }));
try {
  for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const version of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    let failEvidence = true;
    await context.addInitScript(() => { Math.random = () => .314; window.KPLAnalytics = { trackEvent() {} }; });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' || url.pathname.includes('/api/') || /\/__event(?:\/|$)/.test(url.pathname) || !['GET','HEAD'].includes(route.request().method())) { report.blocked.push(url.pathname); return route.abort(); }
      if (version === 'after' && width === 1440 && theme === 'light' && url.pathname.endsWith('link_evidence.json') && failEvidence) {
        failEvidence = false; return route.fulfill({ status: 503, body: 'intentional local failure' });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(`${server.url}/${version}/?theme=${theme}`); await page.locator('#game-content').waitFor(); await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const startup = await measure(page);
    if (version === 'after') assert.equal(startup.dataResources.some(item => item.name.includes('evidence')), false);
    await page.locator('[data-insert-index]').first().click(); await page.locator('#player-search').waitFor();
    const search = await measure(page);
    await page.evaluate(() => {
      window.__firstOption = document.querySelector('[role=option]'); window.__mutations = 0;
      new MutationObserver(records => { window.__mutations += records.filter(record => record.type === 'childList').length; }).observe(document.querySelector('#player-options'), { childList: true, subtree: true });
    });
    for (let count = 0; count < 15; count++) await page.locator('#player-search').press('ArrowDown');
    const arrows = await page.evaluate(() => ({ sameNode: __firstOption === document.querySelector('[role=option]'), childListMutations: __mutations,
      scrollTop: document.querySelector('#player-options').scrollTop, selected: document.querySelectorAll('[role=option][aria-selected=true]').length,
      activeId: document.querySelector('#player-search').getAttribute('aria-activedescendant') }));
    if (version === 'after') { assert.equal(arrows.sameNode, true); assert.equal(arrows.childListMutations, 0); assert.equal(arrows.selected, 1); assert.ok(arrows.scrollTop > 0); }
    await page.locator('#player-search').fill('Cat');
    await page.locator('#player-search').press('ArrowDown'); await page.locator('#player-search').press('Enter');
    if (version === 'after') {
      assert.equal(await page.evaluate(() => Boolean(document.activeElement?.matches('[data-remove-index]'))), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.path-node').count(), 2);
      assert.equal(await page.evaluate(() => Boolean(document.activeElement?.matches('[data-insert-index]'))), true);
      await page.keyboard.press('Enter'); await page.locator('#player-search').press('Escape');
      assert.equal(await page.evaluate(() => Boolean(document.activeElement?.matches('[data-insert-index]'))), true);
    }
    if (version === 'after' && width === 1440 && theme === 'light') {
      const pathBefore = await page.locator('.path-node strong').allTextContents();
      await page.locator('#submit-path').click();
      assert.equal((await measure(page)).dataResources.some(item => item.name.includes('evidence')), false);
      await page.locator('[data-action=reveal]').click();
      await page.locator('[data-action=evidence]').filter({ hasText: '重试' }).waitFor();
      assert.equal(await page.locator('.answer-path').isVisible(), true);
      assert.deepEqual(await page.locator('.path-node strong').allTextContents(), pathBefore);
      await page.locator('[data-action=evidence]').click(); await page.locator('.evidence-list').waitFor();
      assert.deepEqual(await page.locator('.path-node strong').allTextContents(), pathBefore);
      report.checks.push('答案/详细证据懒加载：故意503后答案与原路径保留，重试成功；提交本身不加载证据');
    }
    await page.screenshot({ path: path.join(root, 'reports', `${version}-${width}-${theme}.png`), fullPage: true });
    report.runs.push({ version, width, theme, reducedMotion: width === 390, startup, search, arrows });
    await context.close();
  }
  const faultContext = await browser.newContext(); let faultOnce = true, graphAttempts = 0;
  await faultContext.addInitScript(() => { window.KPLAnalytics = { trackEvent() {} }; });
  await faultContext.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.pathname.includes('/api/') || /\/__event(?:\/|$)/.test(url.pathname) || !['GET','HEAD'].includes(route.request().method())) return route.abort();
    if (url.pathname.endsWith('link_graph.json')) {
      graphAttempts++;
      if (faultOnce) { faultOnce = false; return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>fallback</html>' }); }
    }
    return route.continue();
  });
  const faultPage = await faultContext.newPage();
  await faultPage.goto(`${server.url}/after/`); await faultPage.locator('#error-state').waitFor();
  assert.equal(await faultPage.locator('#game-content').isVisible(), false);
  await faultPage.evaluate(() => { document.querySelector('#retry-load').click(); document.querySelector('#retry-load').click(); });
  await faultPage.locator('#game-content').waitFor(); assert.equal(graphAttempts, 2);
  report.checks.push('核心JSON伪装HTML时禁止进入；连续点击重试共享单次核心加载并恢复');
  await faultContext.close();
  assert.deepEqual(report.pageErrors, []);
  report.checks.push('390/1440px × light/dark，390px reduced-motion，真实键盘增删/焦点/滚动，无水平溢出；箭头更新0childList，DOM节点保持');
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await fs.mkdir(path.join(root, 'reports'), { recursive: true });
  await fs.writeFile(path.join(root, 'reports/optimization-browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checks: report.checks, failure: report.failure, runs: report.runs.length }));
  await browser.close(); await server.close();
}
