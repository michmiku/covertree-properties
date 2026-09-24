import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** Shared MSW server. Tests add Weatherstack handlers with `server.use(...)`. */
export const server = setupServer();

/**
 * Records every outbound HTTP request and fails it. `onUnhandledRequest: 'error'` alone only makes
 * a stray request error, which code could swallow; asserting on this list proves none was made.
 */
export function recordOutboundRequests(): URL[] {
  const requests: URL[] = [];
  server.use(
    http.all('*', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.error();
    }),
  );
  return requests;
}
