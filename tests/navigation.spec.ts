import { test, expect } from '@playwright/test';
import { articlePath, expectAlignedHeader, expectUncoveredTarget } from './helpers/navigation';

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

for (const width of [390, 1440]) {
	test(`keyboard navigation and search focus at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#main')).toBeFocused();
		await page.goto('/');
		for (const selector of ['.skip-link', '.wordmark', '.primary-nav a[href="/"]', '.primary-nav a[href="/posts/1/"]']) {
			await page.keyboard.press('Tab');
			await expect(page.locator(selector)).toBeFocused();
			expect(await page.locator(selector).evaluate((element) => getComputedStyle(element).outlineStyle), 'keyboard focus indicator').not.toBe('none');
		}
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/posts/1/');
		await expect(page.locator('.primary-nav [aria-current]')).toHaveText('Posts');
		await page.evaluate(() => document.fonts.ready);
		const before = await expectAlignedHeader(page);
		const trigger = page.getByRole('button', { name: 'Search the blog' });
		await trigger.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('searchbox')).toBeFocused();
		await page.getByRole('searchbox').fill('CTF');
		await expect(page.locator('.search-results a')).not.toHaveCount(0);
		const tabStops = await page.locator('#search-dialog a, #search-dialog button, #search-dialog input').count();
		for (const key of ['Tab', 'Shift+Tab']) {
			for (let i = 0; i <= tabStops; i++) {
				await page.keyboard.press(key);
				// Native dialogs may tab into browser chrome. They must never let
				// focus reach an underlying page control while the modal is open.
				expect(await page.locator('#search-dialog').evaluate((dialog) =>
					dialog.contains(document.activeElement) || (!document.hasFocus() && document.activeElement === document.body),
				), 'focus escaped onto the underlying page').toBe(true);
			}
		}
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(trigger).toBeFocused();
		const after = await expectAlignedHeader(page);
		expect(after.controls, 'closing search must restore header positions').toEqual(before.controls);
	});

	test(`back and forward restore routes, active links and theme at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await page.getByRole('button', { name: 'Switch to dark theme' }).click();
		await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Posts', exact: true }).click();
		await page.locator('.tag-filter').getByRole('link', { name: 'web 1', exact: true }).click();
		await page.locator('.post-row .title').click();
		await expect(page).toHaveURL(articlePath);
		const history = [
			{ route: '/', active: 'Home', heading: 'Randomguy’s blog' },
			{ route: '/posts/1/', active: 'Posts', heading: 'All posts' },
			{ route: '/tags/web/1/', active: 'Posts', heading: 'Posts about web' },
			{ route: articlePath, active: 'Posts', heading: 'Weaponizing unicode case folding and URL inflation to create a new XS-Search oracle' },
		];
		for (const direction of ['back', 'forward'] as const) {
			const states = direction === 'back' ? history.slice(0, -1).reverse() : history.slice(1);
			for (const state of states) {
				if (direction === 'back') await page.goBack(); else await page.goForward();
				await expect(page).toHaveURL(state.route);
				await expect(page.locator('h1')).toHaveText(state.heading);
				await expect(page.locator('.primary-nav [aria-current]')).toHaveCount(1);
				await expect(page.locator('.primary-nav [aria-current]')).toHaveText(state.active);
				await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
				if (state.route.includes('/tags/')) await expect(page.locator('.tag-filter [aria-current]')).toContainText('web');
			}
		}
		// Enhancements must still work after history navigation.
		await page.getByRole('button', { name: 'Search the blog' }).click();
		await expect(page.getByRole('searchbox')).toBeFocused();
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Switch to light theme' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	});

	test(`article anchors stay below the sticky header at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(articlePath);
		const nav = page.getByRole('navigation', { name: width <= 800 ? 'Article contents on mobile' : 'Article contents', exact: true });
		const hrefs = await nav.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
		for (const href of hrefs) {
			if (width <= 800) await page.locator('.mobile-toc summary').click();
			await nav.locator(`a[href="${href}"]`).click();
			await expect(page).toHaveURL(`${articlePath}${href}`);
			await expectUncoveredTarget(page, decodeURIComponent(href.slice(1)));
			if (width <= 800) await expect(page.locator('.mobile-toc')).not.toHaveAttribute('open');
		}
		// Direct links and refreshes must use the same header clearance.
		await page.goto(`${articlePath}#mitigations`);
		await expectUncoveredTarget(page, 'mitigations');
		await page.reload();
		await expectUncoveredTarget(page, 'mitigations');
	});
}

test('article breadcrumb and newer/older links complete the reading loop', async ({ page }) => {
	await page.goto(articlePath);
	await page.getByRole('navigation', { name: 'More posts' }).getByRole('link', { name: /Newer post/ }).click();
	await expect(page).toHaveURL('/posts/welcome/');
	await expect(page.locator('h1')).toHaveText('Welcome');
	await page.getByRole('navigation', { name: 'More posts' }).getByRole('link', { name: /Older post/ }).click();
	await expect(page).toHaveURL(articlePath);
	await page.locator('.breadcrumb').click();
	await expect(page).toHaveURL('/posts/1/');
	await expect(page.locator('.primary-nav [aria-current]')).toHaveText('Posts');
});
