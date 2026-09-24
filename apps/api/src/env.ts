import { z } from 'zod';
import { loadRootEnv } from './load-env.ts';

const Env = z.object({
  DATABASE_URL: z.url(),
  // Free tier is HTTP-only (SPEC open questions), so the base URL is configurable.
  WEATHERSTACK_BASE_URL: z.url().default('http://api.weatherstack.com'),
  WEATHERSTACK_ACCESS_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
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
