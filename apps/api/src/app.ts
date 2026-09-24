import { readFileSync } from 'node:fs';
import { createSchema, createYoga } from 'graphql-yoga';
import type { Context } from './context.ts';
import { resolvers } from './resolvers/index.ts';

const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');

/** Builds the GraphQL app. Dependencies are passed in so tests can inject fakes. */
export function createApp(context: Context) {
  return createYoga({
    schema: createSchema<Context>({ typeDefs, resolvers }),
    context,
  });
}
