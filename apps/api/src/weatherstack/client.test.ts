import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw.ts';
import { TEST_ACCESS_KEY, weatherstack, weatherstackFixture } from '../../test/weatherstack.ts';
import { createWeatherstackClient, WEATHERSTACK_TIMEOUT_MS, type WeatherLookup } from './client.ts';

const client = (timeoutMs?: number) =>
  createWeatherstackClient({
    baseUrl: 'http://weatherstack.test',
    accessKey: TEST_ACCESS_KEY,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

const failure = (lookup: WeatherLookup) => {
  if (lookup.ok) throw new Error('expected a failed lookup');
  return lookup;
};

describe('Weatherstack client', () => {
  it('S5.2 sends one /current request with query, units=f and the access key', async () => {
    const requests: URL[] = [];
    server.use(weatherstack.ok(requests));

    await client().current('85268, AZ, USA');

    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(requests[0]!.searchParams)).toEqual({
      access_key: TEST_ACCESS_KEY,
      query: '85268, AZ, USA',
      units: 'f',
    });
  });

  it('S5.5 parses string lat/lon into numbers on success', async () => {
    server.use(weatherstack.ok());

    const lookup = await client().current('85268, AZ, USA');

    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.response.location).toMatchObject({ lat: 33.609, lon: -111.729 });
    expect(lookup.response.current.temperature).toBe(79);
  });

  const withCurrent = (current: Record<string, unknown>, requests: URL[]) =>
    weatherstack.ok(requests, {
      ...weatherstackFixture,
      current: { ...weatherstackFixture.current, ...current },
    });

  it.each([
    ['NETWORK', (r: URL[]) => weatherstack.networkError(r)],
    ['HTTP_ERROR', (r: URL[]) => weatherstack.httpError(500, r)],
    ['UPSTREAM_ERROR', (r: URL[]) => weatherstack.successFalse(r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.notJson(r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.missingCurrent(r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.withLocation({ lat: 'north' }, r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.withLocation({ lat: '91' }, r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.withLocation({ lon: '-181' }, r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.withLocation({ lat: '0x10' }, r)],
    ['INVALID_RESPONSE', (r: URL[]) => weatherstack.withLocation({ lat: '1e1' }, r)],
    ['INVALID_RESPONSE', (r: URL[]) => withCurrent({ humidity: 42.5 }, r)],
  ])('S5.5 reports %s after exactly one request, without retrying', async (reason, handler) => {
    const requests: URL[] = [];
    server.use(handler(requests));

    const lookup = failure(await client().current('85268, AZ, USA'));

    expect(lookup.reason).toBe(reason);
    expect(requests).toHaveLength(1);
    expect(lookup.detail).not.toContain(TEST_ACCESS_KEY);
  });

  it('S5.5 reports TIMEOUT when no response arrives in time', async () => {
    server.use(weatherstack.timeout());

    const lookup = failure(await client(50).current('85268, AZ, USA'));

    expect(lookup.reason).toBe('TIMEOUT');
  });

  it('S5.5 reports TIMEOUT when the body stalls after the headers', async () => {
    server.use(
      http.get(
        'http://weatherstack.test/current',
        () =>
          new HttpResponse(
            new ReadableStream({
              start: (controller) => controller.enqueue(new TextEncoder().encode('{')),
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    const lookup = failure(await client(50).current('85268, AZ, USA'));

    expect(lookup.reason).toBe('TIMEOUT');
  });

  it('S5.5 times out after 5 seconds by default', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    server.use(weatherstack.ok());

    await client().current('85268, AZ, USA');

    expect(WEATHERSTACK_TIMEOUT_MS).toBe(5000);
    expect(timeout).toHaveBeenCalledWith(5000);
    timeout.mockRestore();
  });

  it('S5.7 keeps a path prefix on the configured base URL', async () => {
    const requests: URL[] = [];
    server.use(
      http.get('http://stub.test/weatherstack/current', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(weatherstackFixture);
      }),
    );
    const prefixed = createWeatherstackClient({
      baseUrl: 'http://stub.test/weatherstack',
      accessKey: TEST_ACCESS_KEY,
    });

    expect((await prefixed.current('85268, AZ, USA')).ok).toBe(true);
    expect(requests).toHaveLength(1);
  });
});
