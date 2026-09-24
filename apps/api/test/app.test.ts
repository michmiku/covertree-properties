import { describe, expect, it, vi } from 'vitest';
import { type AppOptions, createApp } from '../src/app.ts';

function app(options?: AppOptions) {
  return createApp(
    {
      services: {
        createProperty: vi.fn(),
        deleteProperty: vi.fn(),
        getProperty: vi.fn(),
        listProperties: vi.fn(),
      },
    },
    options,
  );
}

function preflight(origin: string, options: AppOptions) {
  return app(options).fetch('http://api.test/graphql', {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'POST' },
  });
}

describe('api app', () => {
  it('serves the schema at /graphql', async () => {
    const response = await app().fetch('http://api.test/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __type(name: "Property") { name } }' }),
    });

    expect(await response.json()).toEqual({ data: { __type: { name: 'Property' } } });
  });

  it('allows CORS only for the configured web origin', async () => {
    const options = { webOrigin: 'http://localhost:5173' };

    const allowed = await preflight('http://localhost:5173', options);
    const other = await preflight('http://evil.test', options);

    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(other.headers.get('access-control-allow-origin')).not.toBe('http://evil.test');
  });

  it('serves GraphiQL only when enabled', async () => {
    const get = (options: AppOptions) =>
      app(options).fetch('http://api.test/graphql', { headers: { accept: 'text/html' } });

    expect((await get({ graphiql: true })).headers.get('content-type')).toMatch(/text\/html/);
    expect((await get({})).headers.get('content-type') ?? '').not.toMatch(/text\/html/);
  });
});
