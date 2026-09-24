import { SortDirection, USState } from '@/gql/graphql';
import { NO_FILTER, type FilterValues } from './property-filters';

/**
 * The list's filters and sort live in the URL (SPEC P1), e.g. `/?city=hills&state=AZ&sort=oldest`,
 * so they survive a reload and can be shared. Defaults are left out to keep URLs short.
 */
export interface ListParams {
  filter: FilterValues;
  direction: SortDirection;
}

const STATES = new Set<string>(Object.values(USState));

/**
 * Hand-edited or stale URLs must not break the page: an invalid zip or state is ignored rather
 * than sent to the API, which would reject the whole query (S3.6, S3.7).
 */
export function readListParams(params: URLSearchParams): ListParams {
  const zipCode = params.get('zip')?.trim() ?? '';
  const state = params.get('state') ?? '';
  return {
    filter: {
      ...NO_FILTER,
      city: params.get('city') ?? '',
      zipCode: /^\d{5}$/.test(zipCode) ? zipCode : '',
      state: STATES.has(state) ? state : '',
    },
    direction: params.get('sort') === 'oldest' ? SortDirection.ASC : SortDirection.DESC,
  };
}

export function writeListParams({ filter, direction }: ListParams): URLSearchParams {
  const params = new URLSearchParams();
  const city = filter.city.trim();
  const zipCode = filter.zipCode.trim();
  if (city) params.set('city', city);
  if (zipCode) params.set('zip', zipCode);
  if (filter.state) params.set('state', filter.state);
  if (direction === SortDirection.ASC) params.set('sort', 'oldest');
  return params;
}

/** Set on links into a property so its page can return to the same filtered list. */
export interface ListLocationState {
  listSearch?: string;
}

export function listPath(state: unknown): string {
  const search = (state as ListLocationState | null)?.listSearch;
  return search ? `/${search}` : '/';
}
