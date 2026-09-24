import { delay, http, HttpResponse } from 'msw';
import fixture from './fixtures/weatherstack-current.json' with { type: 'json' };

/** Matches WEATHERSTACK_BASE_URL in vitest.config.ts. */
export const WEATHERSTACK_URL = 'http://weatherstack.test/current';
export const TEST_ACCESS_KEY = 'test-key';

/** Real response recorded by `weatherstack:probe "85268, AZ, USA"` (lat/lon are strings). */
export const weatherstackFixture = fixture;

type Body = Record<string, unknown>;

/** Handler that answers with `body` and records every request URL it receives. */
function respond(body: Body | (() => Response | Promise<Response>), requests: URL[] = []) {
  return http.get(WEATHERSTACK_URL, async ({ request }) => {
    requests.push(new URL(request.url));
    return typeof body === 'function' ? body() : HttpResponse.json(body);
  });
}

/** One MSW handler per Weatherstack outcome (SPEC S5.5). */
export const weatherstack = {
  ok: (requests?: URL[], body: Body = fixture) => respond(body, requests),
  withLocation: (location: Body, requests?: URL[]) =>
    respond({ ...fixture, location: { ...fixture.location, ...location } }, requests),
  networkError: (requests?: URL[]) => respond(() => HttpResponse.error(), requests),
  timeout: (requests?: URL[]) =>
    respond(async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }, requests),
  httpError: (status = 500, requests?: URL[]) =>
    respond(() => new HttpResponse('upstream down', { status }), requests),
  successFalse: (requests?: URL[]) =>
    respond(
      {
        success: false,
        error: {
          code: 101,
          type: 'invalid_access_key',
          info: 'You have not supplied a valid API Access Key.',
        },
      },
      requests,
    ),
  notJson: (requests?: URL[]) =>
    respond(() => new HttpResponse('<html>oops</html>', { status: 200 }), requests),
  missingCurrent: (requests?: URL[]) => respond({ location: fixture.location }, requests),
  /** Holds every response until `count` requests have arrived, then answers them all with `ok`. */
  afterRequests: (count: number, requests: URL[] = []) => {
    let release: () => void;
    const arrived = new Promise<void>((resolve) => (release = resolve));
    return respond(async () => {
      if (requests.length >= count) release();
      await arrived;
      return HttpResponse.json(fixture);
    }, requests);
  },
};
