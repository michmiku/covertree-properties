import { graphql } from '@/gql';

export const DeletePropertyMutation = graphql(`
  mutation DeleteProperty($id: ID!) {
    deleteProperty(id: $id) {
      __typename
      ... on DeletePropertySuccess {
        id
      }
      ... on PropertyNotFoundError {
        message
        id
      }
    }
  }
`);
