import { z } from 'zod';
import type {
  Address,
  PropertyRecord,
  PropertyRepository,
  USState,
} from '../repositories/property.repository.ts';
import type { WeatherFailureReason, WeatherstackClient } from '../weatherstack/client.ts';

export interface CreatePropertyInput {
  street: string;
  city: string;
  state: USState;
  zipCode: string;
}

export interface FieldError {
  field: keyof CreatePropertyInput;
  message: string;
}

export type CreatePropertyResult =
  | { kind: 'created'; property: PropertyRecord }
  | { kind: 'invalidInput'; fieldErrors: FieldError[] }
  | { kind: 'duplicate'; existingPropertyId: string }
  | { kind: 'weatherUnavailable'; reason: WeatherFailureReason };

export type CreateProperty = (input: CreatePropertyInput) => Promise<CreatePropertyResult>;

/** S5.6 — Weatherstack names territories only in `region`, so one list covers every USState. */
const US_COUNTRIES: ReadonlySet<string> = new Set([
  'USA United States of America',
  'United States of America',
]);

/** S5.3 — rules GraphQL can't express. `state` is already a valid enum value. */
const Input = z.object({
  street: z
    .string()
    .trim()
    .min(1, 'Street is required.')
    .max(200, 'Street must be at most 200 characters.'),
  city: z
    .string()
    .trim()
    .min(1, 'City is required.')
    .max(100, 'City must be at most 100 characters.'),
  zipCode: z.string().regex(/^\d{5}$/, 'Zip code must be exactly 5 digits.'),
});

export interface CreatePropertyDeps {
  properties: PropertyRepository;
  weatherstack: WeatherstackClient;
  logger?: Pick<Console, 'warn'>;
}

/**
 * S5 — validate → duplicate check → one Weatherstack call → persist. Anything short of complete
 * weather data aborts before writing (ADR-0004).
 */
export function createPropertyService({
  properties,
  weatherstack,
  logger = console,
}: CreatePropertyDeps): CreateProperty {
  return async (input) => {
    const parsed = Input.safeParse(input);
    if (!parsed.success) {
      return {
        kind: 'invalidInput',
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path[0] as FieldError['field'],
          message: issue.message,
        })),
      };
    }

    const address: Address = { ...parsed.data, state: input.state };
    const existing = await properties.findByAddress(address);
    if (existing) return { kind: 'duplicate', existingPropertyId: existing.id };

    const lookup = await weatherstack.current(`${address.zipCode}, ${address.state}, USA`);
    if (!lookup.ok) {
      logger.warn(`Weatherstack lookup failed: ${lookup.reason} (${lookup.detail})`);
      return { kind: 'weatherUnavailable', reason: lookup.reason };
    }

    const { location, current } = lookup.response;
    if (!US_COUNTRIES.has(location.country)) {
      logger.warn(`Weatherstack resolved ${address.zipCode} outside the USA: ${location.country}`);
      return { kind: 'weatherUnavailable', reason: 'LOCATION_MISMATCH' };
    }

    const inserted = await properties.insert({
      ...address,
      weatherData: current,
      lat: location.lat,
      long: location.lon,
    });
    return inserted.ok
      ? { kind: 'created', property: inserted.property }
      : { kind: 'duplicate', existingPropertyId: inserted.duplicateOf };
  };
}
