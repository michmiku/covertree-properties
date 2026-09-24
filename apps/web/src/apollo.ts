import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export function createApolloClient(uri: string) {
  return new ApolloClient({
    link: new HttpLink({ uri }),
    cache: new InMemoryCache({
      typePolicies: {
        // Weather has no id: it is the creation-time snapshot owned by one Property. Merge the
        // list's and the detail view's selections instead of letting one overwrite the other.
        Weather: { merge: true },
      },
    }),
  });
}
