import type {
  PropertyRecord,
  PropertyRepository,
  SortDirection,
} from '../repositories/property.repository.ts';

export interface ListPropertiesOptions {
  /** S2.1 — newest first when omitted. */
  createdAt?: 'ASC' | 'DESC';
}

export type ListProperties = (options?: ListPropertiesOptions) => Promise<PropertyRecord[]>;

const DIRECTION: Record<NonNullable<ListPropertiesOptions['createdAt']>, SortDirection> = {
  ASC: 'asc',
  DESC: 'desc',
};

/** S1/S2 — reads only; never touches Weatherstack (S1.3). */
export function listPropertiesService({
  properties,
}: {
  properties: Pick<PropertyRepository, 'list'>;
}): ListProperties {
  return ({ createdAt = 'DESC' } = {}) => properties.list(DIRECTION[createdAt]);
}
