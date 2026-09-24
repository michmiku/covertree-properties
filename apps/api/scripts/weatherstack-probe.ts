/**
 * Manual check against the REAL Weatherstack API (spends one call per query). Never used by tests.
 *
 *   pnpm --filter api run weatherstack:probe "85268, AZ, USA" [--save test/fixtures/weatherstack-current.json]
 *
 * Prints only non-secret fields. `--save` writes the raw response body as a test fixture.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readEnv } from '../src/env.ts';
import { createWeatherstackClient } from '../src/weatherstack/client.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { save: { type: 'string' } },
});
const query = positionals[0];
if (!query) throw new Error('Usage: weatherstack:probe "<zip>, <state>, USA" [--save <path>]');

const env = readEnv();
const client = createWeatherstackClient({
  baseUrl: env.WEATHERSTACK_BASE_URL,
  accessKey: env.WEATHERSTACK_ACCESS_KEY,
});
const result = await client.current(query);

if (!result.ok) {
  console.log(JSON.stringify({ query, ok: false, reason: result.reason, detail: result.detail }));
  process.exitCode = 1;
} else {
  const { location, current } = result.response;
  console.log(
    JSON.stringify(
      {
        query,
        ok: true,
        location: {
          name: location.name,
          region: location.region,
          country: location.country,
          lat: location.lat,
          lon: location.lon,
        },
        current: { temperature: current.temperature, description: current.weather_descriptions },
      },
      null,
      2,
    ),
  );
  if (values.save) {
    // `request` echoes the query and units only; the access key is not part of the response.
    writeFileSync(values.save, `${JSON.stringify(result.raw, null, 2)}\n`);
    console.log(`saved ${values.save}`);
  }
}
