import type { PropertyRepository } from '../repositories/property.repository.ts';
import { isPropertyId } from './property-id.ts';

export type DeletePropertyResult =
  { kind: 'deleted'; id: string } | { kind: 'notFound'; id: string };

export type DeleteProperty = (id: string) => Promise<DeletePropertyResult>;

/** S6 — never touches Weatherstack (S6.5). Unknown or malformed id → notFound (S6.2). */
export function deletePropertyService({
  properties,
}: {
  properties: Pick<PropertyRepository, 'deleteById'>;
}): DeleteProperty {
  return async (id) =>
    isPropertyId(id) && (await properties.deleteById(id))
      ? // Postgres accepts any case but stores lowercase; return the id as `Property.id` has it.
        { kind: 'deleted', id: id.toLowerCase() }
      : { kind: 'notFound', id };
}
