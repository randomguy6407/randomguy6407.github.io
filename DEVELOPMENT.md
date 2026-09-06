# Development

This repository contains the source for [Randomguy Blog](https://randomguy6407.github.io/).
Astro generates a static website from Markdown and MDX content.

## Local setup

Use Node.js 22.12 or newer. The `.nvmrc` file selects Node 22.

```sh
npm ci
npm run dev
```

Open [localhost:4321](http://localhost:4321/). To check a production build locally:

```sh
npm run build
npm run preview
```

## Writing posts

Add Markdown or MDX files to `src/content/docs/posts/`:

```md
---
title: A new finding
description: A short description of the post.
date: 2026-09-06
tags: [web, research]
draft: false
---

Your article starts here.
```

Only dated posts with `draft: false` are published in the archives and search.
The filename determines the URL, so keep it stable after publishing.
Store article images in `src/assets/` and reference them with relative paths.
Markdown footnotes, highlighted code blocks, and `:::note[Title]` callouts are supported.
Other callout types are `tip`, `caution`, and `danger`.

The About page is `src/content/docs/about.mdx`. Search includes published posts
and the About page, and is generated at build time.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/content/docs/` | Posts and About content |
| `src/assets/` | Images, profile icons, and article illustrations |
| `src/styles/blog.css` | Colors, typography, layout, and responsive styles |
| `src/layouts/SiteLayout.astro` | Header, footer, metadata, and theme preference |
| `src/layouts/ArchiveLayout.astro` | Post and tag archives |
| `src/pages/posts/[...slug].astro` | Article layout and contents navigation |
| `src/components/` | Search, post cards, profile links, and navigation |
| `src/lib/posts.ts` | Post filtering, sorting, and metadata |
| `src/pages/search.json.ts` | Full-text search index |
| `tests/` | Browser and accessibility checks |

## Checks

```sh
npm run check
npm run build
npm run test:browser
```

Browser tests start a production preview on port 4323. Locally, the configuration
uses `/usr/bin/google-chrome`; set `CHROME_PATH` to a Chrome executable on another
system. In CI, Playwright uses its installed Chromium browser.

The tests cover navigation, search, post cards, topic filters, article contents,
theme selection, responsive layouts, keyboard controls, and accessibility checks.
Screenshots and failure traces are saved in `test-results/`.

To build and run only the navigation checks:

```sh
npm run test:navigation
```

## Deployment

Pushes to `main` run the workflow in `.github/workflows/build.yml`. It installs
dependencies, checks the source, builds the site, and runs the browser tests
before deploying `dist/` to GitHub Pages. Pull requests run the checks without
deploying.

The workflow sets `SITE_URL=https://randomguy6407.github.io`. When testing a build
for a different domain, set the same `SITE_URL` for both the build and browser
tests so canonical URLs match. For example, in a POSIX shell:

```sh
export SITE_URL=https://your-domain.example
npm run build
npm run test:browser
```

The site currently uses paths from the domain root. Hosting it under a subdirectory
requires an Astro `base` setting and corresponding internal-link changes.
