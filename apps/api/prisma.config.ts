import { defineConfig } from 'prisma/config';
import { loadRootEnv } from './src/load-env.ts';

loadRootEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Undefined is fine for `prisma generate`; migrate commands fail with a clear message.
  datasource: { url: process.env['DATABASE_URL'] },
});
