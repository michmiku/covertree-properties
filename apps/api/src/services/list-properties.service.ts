import { z } from 'zod';
import type {
  PropertyFilter,
  PropertyRecord,
  PropertyRepository,
  SortDirection,
  USState,
} from '../repositories/property.repository.ts';

export interface ListPropertiesOptions {
  /** S2.1 — newest first when omitted. */
  createdAt?: 'ASC' | 'DESC' | null;
  filter?: {
    city?: string | null;
    zipCode?: string | null;
    state?: USState | null;
  } | null;
}

export type ListPropertiesResult =
  { kind: 'listed'; properties: PropertyRecord[] } | { kind: 'invalidFilter'; message: string };

export type ListProperties = (options?: ListPropertiesOptions) => Promise<ListPropertiesResult>;

const DIRECTION: Record<'ASC' | 'DESC', SortDirection> = { ASC: 'asc', DESC: 'desc' };

/** Trimmed; empty or whitespace-only means "no constraint" (S3.4). */
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || undefined);

const Filter = z.object({
  city: optionalText,
  // S3.5/S3.6 — exact 5 digits when present.
  zipCode: optionalText.refine((zip) => zip === undefined || /^\d{5}$/.test(zip), {
    message: 'Zip code filter must be exactly 5 digits.',
  }),
  state: z
    .custom<USState>()
    .nullish()
    .transform((state) => state ?? undefined),
});

/** S1–S3 — reads only; never touches Weatherstack (S1.3). */
export function listPropertiesService({
  properties,
}: {
  properties: Pick<PropertyRepository, 'list'>;
}): ListProperties {
  return async ({ createdAt, filter } = {}) => {
    const parsed = Filter.safeParse(filter ?? {});
    if (!parsed.success) {
      return { kind: 'invalidFilter', message: parsed.error.issues[0]!.message };
    }
    const normalized: PropertyFilter = parsed.data;
    return {
      kind: 'listed',
      properties: await properties.list({
        direction: DIRECTION[createdAt ?? 'DESC'],
        filter: normalized,
      }),
    };
  };
}
