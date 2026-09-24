import { Prisma, type PrismaClient } from '../__generated__/prisma/client.ts';
import type { Property, USState } from '../__generated__/prisma/client.ts';

/** A persisted property as the rest of the app sees it (SPEC S7). */
export type PropertyRecord = Property;
export type { USState };

/** The address that identifies a property; duplicates are exact matches on all four (S5.4). */
export interface Address {
  street: string;
  city: string;
  state: USState;
  zipCode: string;
}

export interface NewProperty extends Address {
  weatherData: Record<string, unknown>;
  lat: number;
  long: number;
}

export type InsertResult =
  { ok: true; property: PropertyRecord } | { ok: false; duplicateOf: string };

export type SortDirection = 'asc' | 'desc';

/** Already validated and normalized by the service; absent fields apply no constraint. */
export interface PropertyFilter {
  city?: string;
  zipCode?: string;
  state?: USState;
}

export interface ListOptions {
  direction: SortDirection;
  filter?: PropertyFilter;
}

export interface PropertyRepository {
  /** Properties by creation time, ties broken by id in the same direction (S2.3). */
  list(options: ListOptions): Promise<PropertyRecord[]>;
  /** `id` must already be a well-formed UUID (Postgres rejects anything else). */
  findById(id: string): Promise<PropertyRecord | null>;
  findByAddress(address: Address): Promise<PropertyRecord | null>;
  /** Inserts, or reports the existing row when the address unique key is already taken. */
  insert(data: NewProperty): Promise<InsertResult>;
  /** Returns whether a row was removed; `id` must already be a well-formed UUID. */
  deleteById(id: string): Promise<boolean>;
}

const UNIQUE_VIOLATION = 'P2002';

/**
 * Prisma's `contains` passes the value into ILIKE unescaped, so `%` and `_` would act as
 * wildcards. Escape them (and the escape character itself) to match literally (S3.3).
 */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createPropertyRepository(prisma: PrismaClient): PropertyRepository {
  const findByAddress = ({ street, city, state, zipCode }: Address) =>
    prisma.property.findUnique({
      where: { street_city_state_zipCode: { street, city, state, zipCode } },
    });

  return {
    list: ({ direction, filter = {} }) =>
      prisma.property.findMany({
        where: {
          // S3.2 case-insensitive substring.
          ...(filter.city && { city: { contains: escapeLike(filter.city), mode: 'insensitive' } }),
          ...(filter.zipCode && { zipCode: filter.zipCode }),
          ...(filter.state && { state: filter.state }),
        },
        orderBy: [{ createdAt: direction }, { id: direction }],
      }),

    findById: (id) => prisma.property.findUnique({ where: { id } }),

    findByAddress,

    async insert({ weatherData, ...fields }) {
      try {
        const property = await prisma.property.create({
          data: { ...fields, weatherData: weatherData as Prisma.InputJsonObject },
        });
        return { ok: true, property };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_VIOLATION
        ) {
          // Lost a race with a concurrent create of the same address (S5.4).
          const existing = await findByAddress(fields);
          if (existing) return { ok: false, duplicateOf: existing.id };
        }
        throw error;
      }
    },

    // deleteMany reports a count instead of throwing when the row is already gone (S6.3).
    deleteById: async (id) => (await prisma.property.deleteMany({ where: { id } })).count > 0,
  };
}
