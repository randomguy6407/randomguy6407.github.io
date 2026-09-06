// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

// Render Markdown callouts as semantic asides.
/** @returns {import('unified').Transformer<import('mdast').Root>} */
function remarkCallouts() {
	return (tree) => {
		visit(tree, 'containerDirective', (node) => {
			if (!['note', 'tip', 'caution', 'danger'].includes(node.name)) return;
			node.data = { ...node.data, hName: 'aside', hProperties: { className: ['callout', `callout-${node.name}`] } };
			const label = node.children[0];
			if (label?.data && 'directiveLabel' in label.data && label.data.directiveLabel) label.data.hProperties = { className: ['callout-title'] };
		});
	};
}

const site = (process.env.SITE_URL ??
	(process.env.GITHUB_REPOSITORY
		? `https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io`
		: 'http://localhost:4321')).replace(/\/+$/, '');

export default defineConfig({
	site,
	trailingSlash: 'always',
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [remarkDirective, remarkCallouts],
		shikiConfig: { themes: { light: 'github-light-high-contrast', dark: 'github-dark-default' }, defaultColor: false, wrap: false },
	},
	devToolbar: { enabled: false },
});
