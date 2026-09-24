import { graphql } from '@/gql';

export const PropertiesQuery = graphql(`
  query Properties($filter: PropertyFilter, $orderBy: PropertyOrderBy) {
    properties(filter: $filter, orderBy: $orderBy) {
      id
      street
      city
      state
      zipCode
      createdAt
      weatherData {
        temperature
        weatherDescriptions
        weatherIcons
      }
    }
  }
`);
