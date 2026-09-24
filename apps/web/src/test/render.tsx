import { render } from '@testing-library/react';
import { ApolloProvider } from '@apollo/client/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createApolloClient } from '@/apollo';
import { routes } from '@/router';

/** Renders the real routes at `path` with a fresh Apollo client (no cache shared across tests). */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const client = createApolloClient('http://api.test/graphql');
  render(
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>,
  );
  return { router };
}
