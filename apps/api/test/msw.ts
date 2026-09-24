import { setupServer } from 'msw/node';

/** Shared MSW server. Tests add Weatherstack handlers with `server.use(...)`. */
export const server = setupServer();
