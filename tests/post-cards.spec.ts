import { test, expect, type Locator, type Page } from '@playwright/test';
import { articlePath } from './helpers/navigation';

type CardArea = 'title' | 'description' | 'arrow' | 'date' | 'padding' | 'tag whitespace';

async function pointIn(row: Locator, area: CardArea) {
	await row.scrollIntoViewIfNeeded();
	if (area === 'padding') {
		const box = (await row.boundingBox())!;
		return { x: box.x + box.width / 2, y: box.y + box.height - 10 };
	}
	if (area === 'tag whitespace') {
		const box = (await row.locator('.post-tags').boundingBox())!;
		return { x: box.x + box.width - 4, y: box.y + box.height / 2 };
	}
	const selector = { title: 'h3', description: '.post-description', arrow: '.row-arrow', date: 'time' }[area]!;
	const box = (await row.locator(selector).boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const width of [320, 390, 1440]) {
	for (const route of ['/', '/posts/1/', '/tags/meta/1/']) {
		test(`whole post card opens from every area on ${route} at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			for (const area of ['title', 'description', 'arrow', 'date', 'padding', 'tag whitespace'] as const) {
				await page.goto(route);
				await page.evaluate(() => document.fonts.ready);
				const row = page.locator('.post-row[data-post-id="posts/welcome"]');
				const point = await pointIn(row, area);
				// Check the browser's native target, not just a scripted click handler.
				expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), point), area).toBe('/posts/welcome/');
				await page.mouse.click(point.x, point.y);
				await expect(page, area).toHaveURL('/posts/welcome/');
			}
		});
	}

	test(`card tags and keyboard navigation remain independent at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto('/posts/1/');
		const row = page.locator('.post-row[data-post-id="posts/welcome"]');
		const link = row.getByRole('link', { name: 'Welcome', exact: true });
		await expect(row.getByRole('link')).toHaveCount(2);
		await link.focus();
		expect(await link.evaluate(element => getComputedStyle(element, '::after').outlineStyle)).toBe('solid');
		await page.keyboard.press('Tab');
		await expect(row.getByRole('link', { name: 'meta', exact: true })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/tags/meta/1/');
		await page.getByRole('link', { name: 'Welcome', exact: true }).focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/posts/welcome/');
		await page.goto('/posts/1/');
		await row.getByRole('link', { name: 'meta', exact: true }).click();
		await expect(page).toHaveURL('/tags/meta/1/');
	});
}

async function dragText(page: Page, text: Locator) {
	await text.scrollIntoViewIfNeeded();
	const points = await text.evaluate(element => {
		const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
		const range = document.createRange();
		range.setStart(node, 0);
		range.setEnd(node, Math.min(12, node.textContent!.length));
		const rect = range.getClientRects()[0];
		return { start: { x: rect.left + 1, y: rect.top + rect.height / 2 }, end: { x: rect.right - 1, y: rect.top + rect.height / 2 } };
	});
	await page.mouse.move(points.start.x, points.start.y);
	await page.mouse.down();
	await page.mouse.move(points.end.x, points.end.y, { steps: 12 });
	await page.mouse.up();
}

for (const selector of ['h3', '.post-description', 'time']) {
	test(`dragging ${selector} selects text without opening the post`, async ({ page }) => {
		await page.goto('/posts/1/');
		await page.evaluate(() => document.fonts.ready);
		const row = page.locator('.post-row[data-post-id="posts/welcome"]');
		await dragText(page, row.locator(selector));
		await expect(page).toHaveURL('/posts/1/');
		expect(await page.evaluate(() => window.getSelection()?.toString().trim().length)).toBeGreaterThan(3);
		// A prior selection must not make tag links or keyboard activation inert.
		await row.getByRole('link', { name: 'meta', exact: true }).click();
		await expect(page).toHaveURL('/tags/meta/1/');
	});
}

test('keyboard activation still opens a card with selected text', async ({ page }) => {
	await page.goto('/posts/1/');
	await page.evaluate(() => document.fonts.ready);
	const row = page.locator('.post-row[data-post-id="posts/welcome"]');
	await dragText(page, row.locator('.post-description'));
	await row.getByRole('link', { name: 'Welcome', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL('/posts/welcome/');
});

test('a normal card click still works after selecting its text', async ({ page }) => {
	await page.goto('/posts/1/');
	await page.evaluate(() => document.fonts.ready);
	const row = page.locator('.post-row[data-post-id="posts/welcome"]');
	await dragText(page, row.locator('.post-description'));
	await expect(page).toHaveURL('/posts/1/');
	const point = await pointIn(row, 'padding');
	await page.mouse.click(point.x, point.y);
	await expect(page).toHaveURL('/posts/welcome/');
});

for (const action of ['Control-click', 'middle-click'] as const) {
	test(`${action} on card whitespace opens a new tab`, async ({ page, context }) => {
		await page.goto('/posts/1/');
		const point = await pointIn(page.locator('.post-row[data-post-id="posts/welcome"]'), 'padding');
		const opened = context.waitForEvent('page');
		if (action === 'Control-click') await page.keyboard.down('Control');
		try { await page.mouse.click(point.x, point.y, { button: action === 'middle-click' ? 'middle' : 'left' }); }
		finally { if (action === 'Control-click') await page.keyboard.up('Control'); }
		const tab = await opened;
		await expect(tab).toHaveURL('/posts/welcome/');
		await expect(page).toHaveURL('/posts/1/');
		await tab.close();
	});
}

test('whole-card links work without JavaScript', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
	try {
		const page = await context.newPage();
		await page.goto('/posts/1/');
		const row = page.locator('.post-row').filter({ has: page.getByRole('link', { name: /Weaponizing unicode/ }) });
		const point = await pointIn(row, 'description');
		await page.mouse.click(point.x, point.y);
		await expect(page).toHaveURL(articlePath);
	} finally { await context.close(); }
});

test('touch taps open the card while tags keep their own destination', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
	try {
		const page = await context.newPage();
		await page.goto('/posts/1/');
		const row = page.locator('.post-row[data-post-id="posts/welcome"]');
		const point = await pointIn(row, 'padding');
		await page.touchscreen.tap(point.x, point.y);
		await expect(page).toHaveURL('/posts/welcome/');
		await page.goto('/posts/1/');
		await row.getByRole('link', { name: 'meta', exact: true }).tap();
		await expect(page).toHaveURL('/tags/meta/1/');
	} finally { await context.close(); }
});

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`only hovering title text highlights it at ${width}px in ${theme}`, async ({ page }, testInfo) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ colorScheme: theme });
			await page.goto('/posts/1/');
			await page.evaluate(() => document.fonts.ready);
			const row = page.locator('.post-row[data-post-id="posts/welcome"]');
			const title = row.locator('.post-title-text');
			const normalColor = await title.evaluate(element => getComputedStyle(element).color);
			for (const area of ['description', 'date', 'padding', 'tag whitespace', 'title'] as const) {
				// The h3's center is empty space beside this short title, not its text.
				const point = await pointIn(row, area);
				await page.mouse.move(point.x, point.y);
				await expect(title, area).toHaveCSS('text-decoration-line', 'none');
				await expect(title, area).toHaveCSS('color', normalColor);
				await expect(row.locator('.row-arrow'), area).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 2, -2)');
				expect(await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, point), area).toBe('pointer');
			}
			await row.screenshot({ path: testInfo.outputPath('empty-space-hover.png') });
			await title.hover();
			await expect(title).toHaveCSS('text-decoration-line', 'underline');
			await expect(title).not.toHaveCSS('color', normalColor);
			await row.screenshot({ path: testInfo.outputPath('title-hover.png') });
			const point = await pointIn(row, 'padding');
			await page.mouse.move(point.x, point.y);
			await expect(title).toHaveCSS('text-decoration-line', 'none');
			await page.mouse.click(point.x, point.y);
			await expect(page).toHaveURL('/posts/welcome/');
		});
	}
}
