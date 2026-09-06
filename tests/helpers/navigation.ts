import { expect, type Locator, type Page } from '@playwright/test';

export const articlePath = '/posts/unicode-case-folding-xs-search-oracle/';

export async function headerGeometry(page: Page) {
	return page.locator('.site-header').evaluate((header) => {
		const rect = (element: Element) => {
			const { x, y, width, height } = element.getBoundingClientRect();
			return { x, y, width, height };
		};
		const controls = [...header.querySelectorAll<HTMLElement>('.wordmark, .primary-nav a, .header-tools button')].map((element) => {
			const box = rect(element);
			return {
				...box,
				name: element.getAttribute('aria-label') ?? element.textContent!.trim(),
				hit: element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
			};
		});
		const current = header.querySelector('.primary-nav a[aria-current="page"]')!;
		const underline = getComputedStyle(current, '::after');
		return {
			header: rect(header), inner: rect(header.querySelector('.header-inner')!), controls,
			active: rect(current),
			underline: { width: parseFloat(underline.width), height: parseFloat(underline.height), left: parseFloat(underline.left), bottom: parseFloat(underline.bottom) },
		};
	});
}

export async function expectAlignedHeader(page: Page) {
	const layout = await headerGeometry(page);
	const { header, inner, controls, active, underline } = layout;
	expect(Math.abs(header.y), 'sticky header must stay at the top').toBeLessThanOrEqual(1);
	expect(inner.height, 'header should remain a single row').toBeCloseTo(page.viewportSize()!.width <= 520 ? 66 : 76, 0);
	expect(controls).toHaveLength(6);
	for (const [index, control] of controls.entries()) {
		expect(control.width, control.name).toBeGreaterThan(0);
		expect(control.x, `${control.name}: left clipping`).toBeGreaterThanOrEqual(inner.x - 1);
		expect(control.x + control.width, `${control.name}: right clipping`).toBeLessThanOrEqual(inner.x + inner.width + 1);
		expect(Math.abs(control.y + control.height / 2 - inner.y - inner.height / 2), `${control.name}: vertical alignment`).toBeLessThanOrEqual(1);
		expect(control.hit, `${control.name}: control is covered or not clickable`).toBe(true);
		if (index) expect(control.x - controls[index - 1].x - controls[index - 1].width, `${control.name}: overlapping header controls`).toBeGreaterThanOrEqual(-1);
	}
	expect(Math.abs(underline.width - active.width), 'active underline width').toBeLessThanOrEqual(1);
	expect(underline.left, 'active underline left edge').toBe(0);
	expect(underline.height, 'active underline must be visible').toBeGreaterThan(0);
	expect(Math.abs(active.y + active.height - underline.bottom - header.y - header.height), 'active underline bottom edge').toBeLessThanOrEqual(1);
	return layout;
}

export async function expectNoOverlap(links: Locator) {
	const boxes = await links.evaluateAll((elements) => elements.map((element) => {
		const { x, y, width, height } = element.getBoundingClientRect();
		return { x, y, width, height, text: element.textContent!.trim() };
	}));
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i], b = boxes[j];
			const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
			const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
			expect(overlapX > 1 && overlapY > 1, `overlapping links: ${a.text} / ${b.text}`).toBe(false);
		}
	}
}

export async function expectUncoveredTarget(page: Page, id: string) {
	await expect.poll(() => page.evaluate((targetId) => {
		const rect = document.getElementById(targetId)!.getBoundingClientRect();
		const header = document.querySelector('.site-header')!.getBoundingClientRect();
		return rect.top >= header.bottom - 1 && rect.top < innerHeight - 20;
	}, id), { message: `#${id} should land in view below the sticky header` }).toBe(true);
}
