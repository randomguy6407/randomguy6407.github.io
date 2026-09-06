import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const article = '/posts/unicode-case-folding-xs-search-oracle/';
const routes = ['/', '/posts/1/', '/about/', '/tags/', '/tags/web/1/', '/posts/welcome/', article, '/404.html'];

test('desktop visual review in both themes', async ({ page }, testInfo) => {
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: testInfo.outputPath('home-light.png'), fullPage: true });
	await page.getByRole('button', { name: 'Switch to dark theme' }).click();
	await page.screenshot({ path: testInfo.outputPath('home-dark.png'), fullPage: true });
	await page.goto('/posts/1/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('button', { name: 'Switch to light theme' }).click();
	await page.screenshot({ path: testInfo.outputPath('archive.png'), fullPage: true });
	await page.goto(article);
	await page.screenshot({ path: testInfo.outputPath('article-top.png') });
	await page.locator('#example-poc').scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('article-body.png') });
	await page.goto('/about/');
	await page.screenshot({ path: testInfo.outputPath('about.png'), fullPage: true });
});

test('search works with keyboard, full text, empty states, and focus return', async ({ page }) => {
	await page.goto('/');
	const trigger = page.getByRole('button', { name: 'Search the blog' });
	await trigger.click();
	const dialog = page.getByRole('dialog');
	const input = page.getByRole('searchbox');
	await expect(input).toBeFocused();
	await input.fill('CTF');
	await expect(page.locator('.search-results li')).not.toHaveCount(0);
	await input.fill('case folding');
	await expect(page.locator('.search-results li')).toHaveCount(1);
	await input.fill('no-results-for-this-query');
	await expect(page.locator('.search-status')).toContainText('No results');
	await input.fill('[');
	await expect(page.locator('.search-status')).not.toHaveText('Searching…');
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await page.keyboard.press('Control+k');
	await expect(dialog).toBeVisible();
	await input.fill('unicode');
	await expect(page.locator('.search-results li')).toHaveCount(1);
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('.search-results a').first()).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(article));
});

test('archive previews and tag navigation work', async ({ page }) => {
	await page.goto('/posts/1/');
	const welcome = page.locator('.post-row').filter({ hasText: 'Welcome' });
	await welcome.locator('.title').focus();
	await expect(page.locator('.preview-title')).toHaveText('Welcome');
	await page.locator('.post-row').filter({ hasText: 'Weaponizing' }).hover();
	await expect(page.locator('.preview-outline a')).toHaveCount(6);
	await page.locator('.preview-outline a').filter({ hasText: 'Mitigations' }).click();
	await expect(page).toHaveURL(/#mitigations$/);
	await expect(page.locator('#mitigations')).toBeInViewport();
	await page.goto('/posts/1/');
	await page.getByRole('navigation', { name: 'Filter posts by topic' }).getByRole('link', { name: 'web 1', exact: true }).click();
	await expect(page).toHaveURL('/tags/web/1/');
	await expect(page.locator('.post-row')).toHaveCount(1);
	await expect(page.locator('.tag-filter a[aria-current]')).toContainText('web');
	await page.getByRole('navigation', { name: 'Filter posts by topic' }).getByRole('link', { name: 'All posts' }).click();
	await expect(page.locator('.post-row')).toHaveCount(2);
});

test('article sections, images and code copying', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(article);
	await page.getByRole('navigation', { name: 'Article contents', exact: true }).getByRole('link', { name: 'Mitigations', exact: true }).click();
	await expect(page).toHaveURL(/#mitigations$/);
	await expect(page.locator('#mitigations')).toBeInViewport();
	await expect(page.locator('.article-toc a[aria-current]')).toHaveText('Mitigations');
	const code = page.locator('.code-wrap').first();
	await code.hover();
	await code.getByRole('button', { name: 'Copy code' }).click();
	await expect(code.getByRole('button')).toHaveText('Copied');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await code.locator('pre').textContent());
	for (const image of await page.locator('.prose img').all()) {
		await image.scrollIntoViewIfNeeded();
		await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
	}
});

for (const width of [320, 390, 768, 1440]) {
	test(`pages fit at ${width}px with no missing assets or runtime errors`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 900 });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('response', (response) => { if (response.status() >= 400 && !response.url().endsWith('/404.html')) errors.push(`${response.status()} ${response.url()}`); });
		for (const route of routes) {
			await page.goto(route);
			await page.evaluate(() => document.fonts.ready);
			await expect(page.locator('h1')).toHaveCount(1);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
			if (width === 390 && ['/', article, '/posts/1/', '/about/'].includes(route)) {
				await page.screenshot({ path: testInfo.outputPath(`${route === '/' ? 'home' : route.split('/')[1]}-mobile.png`), fullPage: route !== article });
			}
		}
		expect(errors).toEqual([]);
	});
}

test('mobile contents navigation and theme persistence', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(article);
	await page.getByText('On this page', { exact: true }).filter({ visible: true }).click();
	await page.getByRole('navigation', { name: 'Article contents on mobile' }).getByRole('link', { name: 'Mitigations', exact: true }).click();
	await expect(page).toHaveURL(/#mitigations$/);
	await expect(page.locator('.mobile-toc')).not.toHaveAttribute('open');
	await expect(page.locator('#mitigations')).toBeInViewport();
	await page.getByRole('button', { name: 'Switch to dark theme' }).click();
	await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'About' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const theme of ['light', 'dark'] as const) {
	test(`accessibility on key pages in ${theme} theme`, async ({ page }) => {
		await page.addInitScript((value) => localStorage.setItem('astra-theme', value), theme);
		for (const route of ['/', '/posts/1/', '/about/', article]) {
			await page.goto(route);
			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
			expect(results.violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => ({ target: node.target, reason: node.failureSummary })) })), `${theme} ${route}`).toEqual([]);
		}
		await page.getByRole('button', { name: 'Search the blog' }).click();
		await page.getByRole('searchbox').fill('unicode');
		await expect(page.locator('.search-results li')).toHaveCount(1);
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
		expect(results.violations.map(({ id }) => id)).toEqual([]);
	});
}

test('canonical URLs, redirects and internal destinations', async ({ page, request }) => {
	expect((await request.get('/rss.xml')).status()).toBe(404);
	await page.goto('/posts/');
	await expect(page).toHaveURL('/posts/1/');
	await page.goto('/tags/web/');
	await expect(page).toHaveURL('/tags/web/1/');
	const destinations = new Set<string>();
	for (const route of ['/', '/posts/1/', '/about/', article]) {
		await page.goto(route);
		await expect(page.locator('a[href="/rss.xml"], link[type="application/rss+xml"]')).toHaveCount(0);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `http://localhost:4321${route}`);
		const links = await page.locator('a[href^="/"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!.split('#')[0]));
		links.forEach((link) => destinations.add(link));
	}
	for (const link of destinations) expect((await request.get(link)).status(), link).toBeLessThan(400);
	await page.goto('/definitely-not-a-page/');
	await expect(page.getByRole('heading', { name: '404 — Page not found' })).toBeVisible();
});

test('reading works without JavaScript and motion can be reduced', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('http://127.0.0.1:4323/');
	await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Posts' }).click();
	await expect(page.locator('.post-row')).toHaveCount(2);
	await page.locator('.title').filter({ hasText: 'Weaponizing' }).click();
	await expect(page.locator('#mitigations')).toHaveText('Mitigations');
	await context.close();
	const reduced = await browser.newContext({ reducedMotion: 'reduce' });
	const reducedPage = await reduced.newPage();
	await reducedPage.goto('http://127.0.0.1:4323/');
	expect(await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
	await reduced.close();
});
