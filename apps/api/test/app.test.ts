import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

describe('api scaffold', () => {
  it('serves the schema at /graphql', async () => {
    const app = createApp({ services: {} });
    const response = await app.fetch('http://api.test/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __type(name: "Property") { name } }' }),
    });

    expect(await response.json()).toEqual({ data: { __type: { name: 'Property' } } });
  });
});
