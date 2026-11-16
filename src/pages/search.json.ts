import { getEntry } from 'astro:content';
import { getPosts } from '../lib/posts';
import { cves } from '../data/site';

export async function GET() {
	const entries = [...await getPosts()];
	const about = await getEntry('docs', 'about');
	if (about) entries.push(about);
	const plain = (body = '') => body
		.replace(/^import .*;$/gm, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, ' ').replace(/[#*`_]/g, '').replace(/\s+/g, ' ').trim();
	return Response.json(entries.map((entry) => ({
		title: entry.id === 'about' ? 'About Zenneth' : entry.data.title,
		url: `/${entry.id}/`, description: entry.data.description ?? '',
		// The About page renders its CVE list from data, so index that text too.
		body: entry.id === 'about' ? `${plain(entry.body)} ${cves.map((cve) => `${cve.id} ${cve.vendor} ${cve.note}`).join(' ')}` : plain(entry.body),
		tags: entry.data.tags,
	})));
}
