import { readFileSync } from 'node:fs';
import { createSchema, createYoga } from 'graphql-yoga';
import type { Context } from './context.ts';
import { resolvers } from './resolvers/index.ts';
import { singleCreatePropertyPlugin } from './validation/single-create-property.ts';

const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');

export interface AppOptions {
  /** Browser origin allowed by CORS. Omitted → no CORS headers, so only same-origin callers. */
  webOrigin?: string;
  /** Serve GraphiQL on GET /graphql. Off unless asked for. */
  graphiql?: boolean;
}

/** Builds the GraphQL app. Dependencies are passed in so tests can inject fakes. */
export function createApp(context: Context, { webOrigin, graphiql = false }: AppOptions = {}) {
  return createYoga({
    schema: createSchema<Context>({ typeDefs, resolvers }),
    context,
    plugins: [singleCreatePropertyPlugin],
    cors: webOrigin ? { origin: webOrigin } : false,
    graphiql,
  });
}
