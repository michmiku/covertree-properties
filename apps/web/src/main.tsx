import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider } from 'react-router/dom';
import { createApolloClient } from './apollo';
import { router } from './router';
import './index.css';

const client = createApolloClient(
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  </StrictMode>,
);
