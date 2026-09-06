import { test, expect } from '@playwright/test';
import { articlePath, expectAlignedHeader, expectNoOverlap } from './helpers/navigation';

// Test both sides of the header/contents breakpoints, not just device presets.
for (const width of [320, 390, 520, 521, 800, 801, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`navigation alignment at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme: theme });
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			let baseline: Awaited<ReturnType<typeof expectAlignedHeader>> | undefined;
			for (const [route, active] of [['/', 'Home'], ['/posts/1/', 'Posts'], ['/tags/web/1/', 'Posts'], [articlePath, 'Posts'], ['/about/', 'About']]) {
				await page.goto(route);
				await page.evaluate(() => document.fonts.ready);
				await expect(page.locator('.primary-nav [aria-current]')).toHaveCount(1);
				await expect(page.locator('.primary-nav [aria-current]')).toHaveText(active);
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				const layout = await expectAlignedHeader(page);
				baseline ??= layout;
				for (const [index, control] of layout.controls.entries()) {
					for (const dimension of ['x', 'y', 'width', 'height'] as const) {
						expect(Math.abs(control[dimension] - baseline.controls[index][dimension]), `${route}: ${control.name} ${dimension} changed between pages`).toBeLessThanOrEqual(1);
					}
				}
				const shell = await page.locator('main > .shell').boundingBox();
				const footer = await page.locator('.site-footer').boundingBox();
				expect(Math.abs(shell!.x - footer!.x), `${route}: main/footer left alignment`).toBeLessThanOrEqual(1);
				expect(Math.abs(shell!.width - footer!.width), `${route}: main/footer width`).toBeLessThanOrEqual(1);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: horizontal overflow`).toBe(true);
				await expectNoOverlap(page.locator('.tag-filter a'));
				if (route === '/posts/1/' || route === '/tags/web/1/') {
					await expect(page.locator('.post-preview')).toBeVisible({ visible: width > 800 });
					if (width > 800) {
						const list = (await page.locator('.post-list').boundingBox())!;
						const rail = (await page.locator('.post-preview').boundingBox())!;
						expect(rail.x, 'preview must not overlap the post list').toBeGreaterThan(list.x + list.width);
					}
				}
				if (route === articlePath) {
					await expect(page.locator('.article-toc')).toBeVisible({ visible: width > 800 });
					await expect(page.locator('.mobile-toc')).toBeVisible({ visible: width <= 800 });
					await page.locator('#mitigations').scrollIntoViewIfNeeded();
					await expectAlignedHeader(page);
				}
			}
		});
	}
}

test('alignment assertions reject deliberate visual regressions', async ({ page }) => {
	await page.goto('/posts/1/');
	await page.evaluate(() => document.fonts.ready);
	await expectAlignedHeader(page);
	// Browser-only mutations: prove the checks fail without changing site files.
	for (const [css, error] of [
		['.primary-nav { transform: translateY(12px) !important; }', 'vertical alignment'],
		['.primary-nav a + a { margin-left: -40px !important; }', 'overlapping header controls'],
		['.primary-nav a[aria-current]::after { width: 3px !important; }', 'active underline width'],
	]) {
		const style = await page.addStyleTag({ content: css });
		try { await expect(expectAlignedHeader(page)).rejects.toThrow(error); }
		finally { await style.evaluate((element) => element.parentNode?.removeChild(element)); }
		await expectAlignedHeader(page);
	}
});

test('header and contents recover after resizing across breakpoints', async ({ page }) => {
	await page.goto(articlePath);
	await page.evaluate(() => document.fonts.ready);
	for (const width of [1500, 1499, 1051, 1050, 801, 800, 521, 520, 360, 359, 320, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await expectAlignedHeader(page);
		await expect(page.locator('.article-toc')).toBeVisible({ visible: width > 800 });
		await expect(page.locator('.mobile-toc')).toBeVisible({ visible: width <= 800 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow after resizing to ${width}`).toBe(true);
	}
});
