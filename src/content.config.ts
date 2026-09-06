import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
			date: z.coerce.date().optional(),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
		}),
	}),
};
