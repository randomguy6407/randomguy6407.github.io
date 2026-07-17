import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
	// `site` comes from astro.config.mjs; the build warns loudly if unset.
	const base = site ?? new URL('http://localhost:4321');
	const posts = await getPosts();

	const items = posts
		.map((post) => {
			const url = new URL(`/${post.id}/`, base).href;
			return [
				'		<item>',
				`			<title>${escapeXml(post.data.title)}</title>`,
				`			<link>${escapeXml(url)}</link>`,
				`			<guid isPermaLink="true">${escapeXml(url)}</guid>`,
				post.data.description
					? `			<description>${escapeXml(post.data.description)}</description>`
					: null,
				`			<pubDate>${post.data.date!.toUTCString()}</pubDate>`,
				...(post.data.tags ?? []).map(
					(t) => `			<category>${escapeXml(t)}</category>`,
				),
				'		</item>',
			]
				.filter(Boolean)
				.join('\n');
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>Randomguy's blog</title>
		<link>${escapeXml(base.href)}</link>
		<atom:link href="${escapeXml(new URL('/rss.xml', base).href)}" rel="self" type="application/rss+xml"/>
		<description>security, reverse engineering, and infrastructure writeups.</description>
		<language>en</language>
${items}
	</channel>
</rss>
`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
	});
};
