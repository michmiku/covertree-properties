/**
 * Services resolvers may call (SPEC X1). Each story slice adds its service here, built in
 * `server.ts` from repositories and, for createProperty only, the Weatherstack client.
 */
export type Services = Record<string, never>;
