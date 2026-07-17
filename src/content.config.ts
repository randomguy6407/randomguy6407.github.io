import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { ExtendDocsSchema } from 'lucode-starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: ExtendDocsSchema.extend({
				date: z.coerce.date().optional(),
				tags: z.array(z.string()).default([]),
			}),
		}),
	}),
};
