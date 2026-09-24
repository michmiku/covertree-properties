import { graphql } from '@/gql';

export const PropertyQuery = graphql(`
  query Property($id: ID!) {
    property(id: $id) {
      id
      street
      city
      state
      zipCode
      lat
      long
      createdAt
      weatherData {
        observationTime
        temperature
        feelsLike
        weatherDescriptions
        weatherIcons
        humidity
        windSpeed
        windDir
      }
    }
  }
`);
