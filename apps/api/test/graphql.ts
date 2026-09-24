import type { createApp } from '../src/app.ts';

export interface GraphQLResponse<TData> {
  data?: TData;
  errors?: { message: string; extensions?: { code?: string } }[];
}

/** POSTs an operation through Yoga in-process (ADR-0002); returns raw text and parsed body. */
export async function executeOperation<TData>(
  app: ReturnType<typeof createApp>,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const response = await app.fetch('http://api.test/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  return { text, body: JSON.parse(text) as GraphQLResponse<TData> };
}
