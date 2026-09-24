import type { PropertyRecord, PropertyRepository } from '../repositories/property.repository.ts';
import { isPropertyId } from './property-id.ts';

export type GetProperty = (id: string) => Promise<PropertyRecord | null>;

/** S4 — reads only; never touches Weatherstack (S4.3). Unknown or malformed id → null (S4.2). */
export function getPropertyService({
  properties,
}: {
  properties: Pick<PropertyRepository, 'findById'>;
}): GetProperty {
  return async (id) => (isPropertyId(id) ? properties.findById(id) : null);
}
