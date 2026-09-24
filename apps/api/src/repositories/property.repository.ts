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

export interface PropertyRepository {
  /** All properties by creation time, ties broken by id in the same direction (S2.3). */
  list(direction: SortDirection): Promise<PropertyRecord[]>;
  findByAddress(address: Address): Promise<PropertyRecord | null>;
  /** Inserts, or reports the existing row when the address unique key is already taken. */
  insert(data: NewProperty): Promise<InsertResult>;
}

const UNIQUE_VIOLATION = 'P2002';

export function createPropertyRepository(prisma: PrismaClient): PropertyRepository {
  const findByAddress = ({ street, city, state, zipCode }: Address) =>
    prisma.property.findUnique({
      where: { street_city_state_zipCode: { street, city, state, zipCode } },
    });

  return {
    list: (direction) =>
      prisma.property.findMany({ orderBy: [{ createdAt: direction }, { id: direction }] }),

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
  };
}
