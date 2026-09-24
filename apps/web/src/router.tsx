import { createBrowserRouter, type RouteObject } from 'react-router';
import { HomeRoute } from './routes/home';
import { NewPropertyRoute } from './routes/new-property';
import { PropertyRoute } from './routes/property';
import { RootLayout } from './routes/root-layout';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: HomeRoute },
      { path: 'properties/new', Component: NewPropertyRoute },
      { path: 'properties/:id', Component: PropertyRoute },
    ],
  },
];

export const router = createBrowserRouter(routes);
