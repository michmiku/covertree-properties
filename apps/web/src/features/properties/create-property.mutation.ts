import { graphql } from '@/gql';

export const CreatePropertyMutation = graphql(`
  mutation CreateProperty($input: CreatePropertyInput!) {
    createProperty(input: $input) {
      __typename
      ... on CreatePropertySuccess {
        property {
          id
        }
      }
      ... on InvalidInputError {
        message
        fieldErrors {
          field
          message
        }
      }
      ... on DuplicatePropertyError {
        message
        existingPropertyId
      }
      ... on WeatherUnavailableError {
        message
        reason
      }
    }
  }
`);
