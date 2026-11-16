import type { ImageMetadata } from 'astro';
import chromium from '../assets/icons/chromium.png';
import f5 from '../assets/icons/f5.png';
import nextjs from '../assets/icons/nextjs.svg';

export interface Cve {
	id: string;
	/** Affected product. Shown beside the id: "CVE-2026-64643 · Next.js". */
	vendor: string;
	/** Public page for the CVE. Leave it out until there is one: the id then shows as plain text. */
	href?: string;
	/** One line about the bug, shown under the CVE on the About page. */
	note: string;
	/** Vendor icon from src/assets/icons. Optional. */
	icon?: ImageMetadata;
}

/** Every CVE, newest first: add new ones at the top. The homepage sidebar
 *  shows the first few and links to the rest; the About page lists them all
 *  in the order they were found. */
export const cves: Cve[] = [
	{
		id: 'CVE-2026-118359',
		vendor: 'Chromium',
		href: 'https://nvd.nist.gov/vuln/detail/CVE-2026-118359',
		note: '<tbd>',
		icon: chromium,
	},
	{
		id: 'CVE-2026-113222',
		vendor: 'Chromium',
		href: 'https://nvd.nist.gov/vuln/detail/CVE-2026-113222',
		note: '<tbd>',
		icon: chromium,
	},
	{
		id: 'CVE-2026-96889',
		// Advisory (Next.js): https://github.com/advisories/GHSA-2464-fhr4-w9xw
		// The NVD page linked below describes the underlying librsvg flaw.
		vendor: 'Next.js',
		href: 'https://nvd.nist.gov/vuln/detail/CVE-2026-96889',
		note: '<tbd>',
		icon: nextjs,
	},
	{
		id: 'CVE-2026-64643',
		vendor: 'Next.js',
		href: 'https://github.com/vercel/next.js/security/advisories/GHSA-955p-x3mx-jcvp',
		note: 'Unauth Server Action IDs leak via publicly served client artifacts',
		icon: nextjs,
	},
	{
		id: 'CVE-2026-42533',
		vendor: 'nginx',
		href: 'https://nvd.nist.gov/vuln/detail/CVE-2026-42533',
		note: 'Collaboration with many other researchers to collectively report this vulnerability!',
		icon: f5,
	},
];

/** How many CVEs the homepage sidebar shows before linking to the full list. */
export const SIDEBAR_CVES = 4;
