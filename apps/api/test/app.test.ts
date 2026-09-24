import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';

describe('api app', () => {
  it('serves the schema at /graphql', async () => {
    const app = createApp({ services: { createProperty: vi.fn() } });
    const response = await app.fetch('http://api.test/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __type(name: "Property") { name } }' }),
    });

    expect(await response.json()).toEqual({ data: { __type: { name: 'Property' } } });
  });
});
