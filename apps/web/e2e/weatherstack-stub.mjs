// Local stand-in for Weatherstack so the running app never spends real API calls.
//   node e2e/weatherstack-stub.mjs            → serves the recorded Fountain Hills response
//   STUB_MODE=success-false node e2e/…       → HTTP 200 { success: false } (UPSTREAM_ERROR)
// Point the API at it with WEATHERSTACK_BASE_URL=http://localhost:4999.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const port = Number(process.env.WEATHERSTACK_STUB_PORT ?? 4999);
const mode = process.env.STUB_MODE ?? 'ok';
const fixture = readFileSync(
  new URL('../../api/test/fixtures/weatherstack-current.json', import.meta.url),
  'utf8',
);
const failure = JSON.stringify({
  success: false,
  error: { code: 104, type: 'usage_limit_reached', info: 'Stubbed failure.' },
});

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://stub');
  if (pathname !== '/current') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(mode === 'success-false' ? failure : fixture);
}).listen(port, () => console.info(`Weatherstack stub (${mode}) on http://localhost:${port}`));
