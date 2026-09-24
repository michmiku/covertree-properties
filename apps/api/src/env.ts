import { z } from 'zod';
import { loadRootEnv } from './load-env.ts';

const Env = z.object({
  DATABASE_URL: z.url(),
  // Configurable so tests and e2e can point at MSW or the local stub.
  WEATHERSTACK_BASE_URL: z.url().default('https://api.weatherstack.com'),
  WEATHERSTACK_ACCESS_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  // The only browser origin allowed to call the API (CORS). Normalized to scheme://host:port.
  WEB_ORIGIN: z
    .url()
    .default('http://localhost:5173')
    .transform((url) => new URL(url).origin),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof Env>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Only the real process env is backed by the repo-root .env; explicit sources (tests) stay pure.
  if (source === process.env) loadRootEnv();
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    // Report variable names only; values may be secrets (SPEC S5.2).
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}. See .env.example.`);
  }
  return parsed.data;
}
