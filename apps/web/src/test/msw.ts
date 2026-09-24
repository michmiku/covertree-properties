import { setupServer } from 'msw/node';

/** Shared MSW server. Tests add `graphql.query/mutation` handlers with `server.use(...)`. */
export const server = setupServer();
