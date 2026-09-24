import { graphql, HttpResponse } from 'msw';
import type { PropertyQuery, PropertyQueryVariables } from '@/gql/graphql';

export type DetailedProperty = NonNullable<PropertyQuery['property']>;

/** A property as the detail query returns it, using the recorded Fountain Hills weather. */
export function detailedProperty(overrides: Partial<DetailedProperty> = {}): DetailedProperty {
  return {
    __typename: 'Property',
    id: 'property-1',
    street: '15528 E Golden Eagle Blvd',
    city: 'Fountain Hills',
    state: 'AZ',
    zipCode: '85268',
    lat: 33.609,
    long: -111.729,
    createdAt: '2026-09-24T10:53:08.106Z',
    weatherData: {
      __typename: 'Weather',
      observationTime: '10:35 AM',
      temperature: 79,
      feelsLike: 81,
      weatherDescriptions: ['Overcast'],
      weatherIcons: ['https://cdn.example/overcast.png'],
      humidity: 42,
      windSpeed: 6,
      windDir: 'NE',
    },
    ...overrides,
  };
}

/** Answers the Property query from `rows` by id; unknown ids get `null` (S4.2). */
export function serveProperty(rows: DetailedProperty[]) {
  return graphql.query<PropertyQuery, PropertyQueryVariables>('Property', ({ variables }) =>
    HttpResponse.json({
      data: {
        __typename: 'Query',
        property: rows.find((row) => row.id === variables.id) ?? null,
      },
    }),
  );
}
