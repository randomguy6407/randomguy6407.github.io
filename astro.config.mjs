// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

// Where this build is served from. Baked in at build time (canonical URLs, the
// sitemap, absolute links in /rss.xml), so it comes from the deploy environment
// rather than being discovered at runtime:
//   SITE_URL           explicit override, always wins
//   GITHUB_REPOSITORY  set by GitHub Actions as "owner/repo" → owner.github.io
//   fallback           local dev and preview builds
const site = (
	process.env.SITE_URL ??
	(process.env.GITHUB_REPOSITORY
		? `https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io`
		: 'http://localhost:4321')
).replace(/\/+$/, '');

// https://astro.build/config
export default defineConfig({
	site,
	integrations: [
		starlight({
			title: 'Randomguy\'s blog',
			plugins: [
				lucode({
					navLinks: [
						{ label: 'posts', link: '/posts/1/' },
						{ label: 'about', link: '/about/' },
						// Absolute on purpose. lucode passes relative nav links through
						// Astro's getRelativeLocaleUrl(), which appends a trailing slash;
						// /rss.xml/ 404s because the feed is a file, not a directory. Its
						// NavBar leaves http(s):// links untouched.
						{ label: 'rss', link: `${site}/rss.xml` },
					],
					footerText: '© 2026 Randomguy\'s blog · EOF',
				}),
			],
			components: {
				Sidebar: './src/overrides/Empty.astro',
				Pagination: './src/overrides/Pagination.astro',
				PageTitle: './src/overrides/PageTitle.astro',
				PageSidebar: './src/overrides/PageSidebar.astro',
				TwoColumnContent: './src/overrides/TwoColumnContent.astro',
				Head: './src/overrides/Head.astro',
			},
			customCss: ['./src/styles/blog.css'],
			sidebar: [],
		}),
	],
});
