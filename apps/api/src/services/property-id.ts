import { z } from 'zod';

/**
 * Any 8-4-4-4-12 hex id, as the Postgres `uuid` type accepts. Anything else is treated like an
 * unknown id (SPEC Decisions: unknown / malformed id) instead of reaching the database as an error.
 */
export const isPropertyId = (id: string) => z.guid().safeParse(id).success;
