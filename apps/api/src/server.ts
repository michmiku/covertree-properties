import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { createPrismaClient } from './db.ts';
import { readEnv } from './env.ts';

const env = readEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({ services: {} });
const server = createServer(app);

server.listen(env.PORT, () => {
  console.info(`GraphQL API on http://localhost:${env.PORT}${app.graphqlEndpoint}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void prisma.$disconnect();
  });
}
