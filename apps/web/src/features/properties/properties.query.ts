import { graphql } from '@/gql';

export const PropertiesQuery = graphql(`
  query Properties($orderBy: PropertyOrderBy) {
    properties(orderBy: $orderBy) {
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
