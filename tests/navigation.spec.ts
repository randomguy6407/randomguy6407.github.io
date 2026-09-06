import { test, expect } from '@playwright/test';

type Frame = { theme?: string; background: string; titleWidth: number; navX: number; codeHeight?: number };
declare global { interface Window { navigationFrames: Frame[] } }

for (const theme of ['light', 'dark']) {
	for (const fontDelay of [0, 250]) {
		test(`navigation has no loading shifts in ${theme}, font delay ${fontDelay}ms`, async ({ page }) => {
			// Routing disables the HTTP cache, exercising each destination cold.
			if (fontDelay) await page.route(/\.woff2(?:\?|$)/, async (route) => {
				await new Promise((resolve) => setTimeout(resolve, fontDelay));
				await route.continue();
			});
			await page.addInitScript((savedTheme) => {
				localStorage.setItem('astra-theme', savedTheme);
				window.navigationFrames = [];
				const sample = () => {
					const title = document.querySelector('h1');
					const nav = document.querySelector('.primary-nav');
					if (title && nav) {
						const range = document.createRange();
						range.selectNodeContents(title);
						window.navigationFrames.push({
							theme: document.documentElement.dataset.theme,
							background: getComputedStyle(document.documentElement).backgroundColor,
							titleWidth: range.getBoundingClientRect().width,
							navX: nav.getBoundingClientRect().x,
							codeHeight: document.querySelector('pre')?.getBoundingClientRect().height,
						});
					}
					if (window.navigationFrames.length < 180) requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			}, theme);

			const expectStableFrames = async () => {
				await page.evaluate(async () => {
					await document.fonts.ready;
					await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
				});
				const frames = await page.evaluate(() => window.navigationFrames);
				expect(frames.length).toBeGreaterThan(1);
				expect([...new Set(frames.map((frame) => frame.theme))], page.url()).toEqual([theme]);
				expect([...new Set(frames.map((frame) => JSON.stringify(frame)))], page.url()).toHaveLength(1);
			};

			await page.goto('/posts/1/');
			await expectStableFrames();
			for (const name of ['About', 'Posts', 'Home', 'Posts']) {
				await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
				await expectStableFrames();
			}
			await page.locator('.post-row .title').filter({ hasText: 'Weaponizing' }).click();
			await expect(page.locator('.code-wrap')).not.toHaveCount(0);
			await expectStableFrames();
		});
	}
}
