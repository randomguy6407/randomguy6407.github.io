import { getCollection, type CollectionEntry } from 'astro:content';
import GithubSlugger from 'github-slugger';

export const PAGE_SIZE = 5;

export type Post = CollectionEntry<'docs'>;

/** A blog post is a dated, non-draft entry under posts/. Single source of
 *  truth — every page must use this so routes never disagree about which
 *  entries exist (a tagged-but-undated post used to get a /tags/x/ redirect
 *  pointing at a /tags/x/1/ page that was never generated). */
export function isBlogPost({ id, data }: { id: string; data: { draft?: boolean; date?: Date } }) {
	return id.startsWith('posts/') && !data.draft && data.date !== undefined;
}

/** All blog posts, newest first, optionally filtered by tag. */
export async function getPosts(tag?: string): Promise<Post[]> {
	const posts = await getCollection('docs', isBlogPost);
	return posts
		.filter((post) => (tag ? (post.data.tags ?? []).includes(tag) : true))
		.sort((a, b) => b.data.date!.valueOf() - a.data.date!.valueOf());
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function tagUrl(tag: string, page = 1): string {
	return `/tags/${encodeURIComponent(tag)}/${page}/`;
}

export function readingMinutes(body: string | undefined): number | null {
	if (typeof body !== 'string' || body.trim().length === 0) return null;
	const words = body.trim().split(/\s+/).length;
	return Math.max(1, Math.round(words / 200));
}

export interface Heading {
	depth: number;
	text: string;
	slug: string;
}

/** Strip the inline markdown that commonly appears in headings so the
 *  preview shows clean text and the slug matches what Astro generates
 *  (Astro slugs the *rendered* text, e.g. backticks removed). */
function stripInlineMd(text: string): string {
	return text
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → label
		.replace(/`([^`]+)`/g, '$1') // inline code
		.replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
		.replace(/(\*|_)(.+?)\1/g, '$2') // italic
		.replace(/~~(.+?)~~/g, '$1'); // strikethrough
}

/** Extract h2/h3 headings from raw markdown for the hover-preview ToC.
 *  Skips fenced code blocks — a `## comment` inside a ```bash fence is not
 *  a heading. Slugs use github-slugger, the same library Astro uses for
 *  heading IDs, so preview anchors always match the rendered page. */
export function extractHeadings(body: string | undefined): Heading[] {
	if (typeof body !== 'string') return [];
	const slugger = new GithubSlugger();
	const headings: Heading[] = [];
	let inFence = false;
	let fenceMarker = '';
	for (const line of body.split('\n')) {
		const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
		if (fence) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fence[1][0];
			} else if (fence[1][0] === fenceMarker) {
				inFence = false;
			}
			continue;
		}
		if (inFence) continue;
		const m = line.match(/^(#{2,3})\s+(.+)/);
		if (!m) continue;
		const text = stripInlineMd(m[2].trim()).replace(/\s+#+\s*$/, '');
		headings.push({ depth: m[1].length, text, slug: slugger.slug(text) });
	}
	return headings;
}

/** Flat, serialisable shape consumed by the list markup and the
 *  hover-preview inline script. */
export interface PostRow {
	id: string;
	title: string;
	description: string;
	date: string;
	dateIso: string;
	tags: string[];
	minutes: number | null;
	headings: Heading[];
}

export function toPostRow(post: Post): PostRow {
	const body = typeof post.body === 'string' ? post.body : undefined;
	return {
		id: post.id,
		title: post.data.title,
		description: post.data.description ?? '',
		date: formatDate(post.data.date!),
		dateIso: post.data.date!.toISOString(),
		tags: post.data.tags ?? [],
		minutes: readingMinutes(body),
		headings: extractHeadings(body),
	};
}

/** Tag → post-count across all posts, most-used first. */
export async function getTagCounts(): Promise<{ tag: string; count: number }[]> {
	const posts = await getPosts();
	const counts: Record<string, number> = {};
	for (const post of posts) {
		for (const t of post.data.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
	}
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([tag, count]) => ({ tag, count }));
}
