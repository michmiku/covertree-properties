import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export function createApolloClient(uri: string) {
  return new ApolloClient({
    link: new HttpLink({ uri }),
    cache: new InMemoryCache({
      typePolicies: {
        // Each result is the complete, unpaginated list for its filter/order (SPEC non-goal:
        // pagination), so a new result replaces the old one, including after a delete.
        Query: { fields: { properties: { merge: false } } },
        // Weather has no id: it is the creation-time snapshot owned by one Property. Merge the
        // list's and the detail view's selections instead of letting one overwrite the other.
        Weather: { merge: true },
      },
    }),
  });
}
