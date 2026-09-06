import { test, expect } from '@playwright/test';
import { expectAlignedHeader } from './helpers/navigation';

for (const theme of ['light', 'dark'] as const) {
	test(`wordmark stays cohesive and navigates home in ${theme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: theme });
		await page.goto('/about/');
		await page.evaluate(() => document.fonts.ready);
		const wordmark = page.getByRole('link', { name: "Randomguy's blog — home", exact: true });
		const suffix = wordmark.locator('.wordmark-blog');
		await expect(wordmark).toHaveText('randomguy/blog');
		await expect(wordmark).toHaveAttribute('href', '/');
		for (const width of [1440, 801, 800, 390, 320]) {
			await page.setViewportSize({ width, height: 900 });
			await expectAlignedHeader(page);
			// Keep the existing compact mobile wordmark so navigation still fits.
			await expect(suffix).toBeVisible({ visible: width > 800 });
			const style = await wordmark.evaluate((element) => {
				const name = getComputedStyle(element);
				const label = getComputedStyle(element.querySelector('.wordmark-blog')!);
				return {
					nameSize: name.fontSize, labelSize: label.fontSize,
					nameSpacing: name.letterSpacing, labelSpacing: label.letterSpacing,
					nameWeight: Number(name.fontWeight), labelWeight: Number(label.fontWeight),
					nameColor: name.color, labelColor: label.color, labelMargin: label.marginLeft,
				};
			});
			expect(style.labelSize).toBe(style.nameSize);
			expect(style.labelSpacing).toBe(style.nameSpacing);
			expect(style.labelWeight).toBeLessThan(style.nameWeight);
			expect(style.labelColor).not.toBe(style.nameColor);
			expect(style.labelMargin).toBe('0px');
		}
		await wordmark.click();
		await expect(page).toHaveURL('/');
		await expect(page.locator('.primary-nav [aria-current]')).toHaveText('Home');
	});
}
