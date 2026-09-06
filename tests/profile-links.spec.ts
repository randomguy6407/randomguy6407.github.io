import { test, expect } from '@playwright/test';
import { expectNoOverlap } from './helpers/navigation';

const github = 'https://github.com/randomguy6407';
const hackerone = 'https://hackerone.com/randomguy6407';
const advisory = 'https://github.com/vercel/next.js/security/advisories/GHSA-955p-x3mx-jcvp';
const destinations = [['GitHub', github], ['HackerOne', hackerone], ['CVE-2026-64643 · Next.js', advisory]];

for (const width of [320, 390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`About profile and CVE links fit at ${width}px in ${theme}`, async ({ page }, testInfo) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ colorScheme: theme });
			await page.goto('/about/');
			await page.evaluate(() => document.fonts.ready);
			const content = page.locator('.about-grid > article');
			for (const [name, href] of destinations) {
				const link = content.getByRole('link', { name, exact: true });
				await expect(link).toBeVisible();
				await expect(link).toHaveAttribute('href', href);
				await expect(link).toHaveAttribute('target', '_blank');
				await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
				const icon = link.locator('img');
				const asset = href === github ? 'github' : href === hackerone ? 'hackerone' : 'nextjs';
				await expect(icon).toHaveAttribute('alt', '');
				await expect(icon).toHaveAttribute('src', new RegExp(`/_astro/${asset}\\..*\\.svg$`));
				await expect(link.locator('svg')).toHaveCount(0);
				await icon.scrollIntoViewIfNeeded();
				await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
			}
			await expect(content.getByRole('link', { name: /^CVE-/ })).toHaveCount(2);
			await expect(content.getByRole('link', { name: 'CVE-2026-42533', exact: true })).toHaveAttribute('href', 'https://nvd.nist.gov/vuln/detail/CVE-2026-42533');
			await expect(content.getByText('Unauth Server Action IDs leak via publicly served client artifacts', { exact: true })).toBeVisible();
			await expect(content.getByText('@randomguy6407', { exact: true })).toBeVisible();
			await expectNoOverlap(content.locator('.icon-link'));
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
			await page.screenshot({ path: testInfo.outputPath('about.png'), fullPage: true });
		});
	}
}

test('About links open their exact destinations in new tabs', async ({ page, context }) => {
	// Stub only the external destinations: the test needs no GitHub session or network access.
	for (const [, href] of destinations) {
		await context.route(href, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>External link destination</title>' }));
	}
	await page.goto('/about/');
	for (const [name, href] of destinations) {
		const opened = context.waitForEvent('page');
		await page.locator('.about-grid > article').getByRole('link', { name, exact: true }).click();
		const tab = await opened;
		await expect(tab).toHaveURL(href);
		await expect(page).toHaveURL('/about/');
		await tab.close();
	}
});

test('GitHub and HackerOne remain reachable in Home and About sidebars', async ({ page }) => {
	for (const route of ['/', '/about/']) {
		await page.goto(route);
		const elsewhere = page.locator('.elsewhere');
		await expect(elsewhere.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', github);
		await expect(elsewhere.getByRole('link', { name: 'HackerOne', exact: true })).toHaveAttribute('href', hackerone);
		await expect(page.getByText('Private Program', { exact: true })).toHaveCount(0);
	}
});
