import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type {
  CreatePropertyMutation,
  CreatePropertyMutationVariables,
  PropertiesQuery,
  PropertiesQueryVariables,
} from '@/gql/graphql';
import { server } from '@/test/msw';
import { detailedProperty, serveProperty } from '@/test/properties';
import { renderRoute } from '@/test/render';

type Property = PropertiesQuery['properties'][number];

function property(street: string, overrides: Partial<Property> = {}): Property {
  return {
    __typename: 'Property',
    id: `id-${street}`,
    street,
    city: 'Fountain Hills',
    state: 'AZ',
    zipCode: '85268',
    createdAt: '2026-09-24T10:53:08.106Z',
    weatherData: {
      __typename: 'Weather',
      temperature: 79,
      weatherDescriptions: ['Overcast'],
      weatherIcons: ['https://cdn.example/overcast.png'],
    },
    ...overrides,
  };
}

/** Serves `rows` for every Properties query and records the variables of each request. */
function serveProperties(rows: Property[], calls: PropertiesQueryVariables[] = []) {
  return graphql.query<PropertiesQuery, PropertiesQueryVariables>('Properties', ({ variables }) => {
    calls.push(variables);
    const ordered = variables.orderBy?.createdAt === 'ASC' ? [...rows].reverse() : rows;
    return HttpResponse.json({ data: { __typename: 'Query', properties: ordered } });
  });
}

/** Streets in display order; the street is the first text in each row. */
const listedStreets = () =>
  within(screen.getByRole('list', { name: 'Properties' }))
    .getAllByRole('link')
    .map((link) => link.querySelector('span')?.textContent);

describe('property list', () => {
  it('S1.1 shows every property with its address and weather', async () => {
    server.use(serveProperties([property('15528 E Golden Eagle Blvd'), property('1 Main St')]));

    renderRoute('/');

    expect(await screen.findByText('15528 E Golden Eagle Blvd')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getAllByText('Fountain Hills, AZ 85268')).toHaveLength(2);
    expect(screen.getAllByText('79°F')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /15528 E Golden Eagle Blvd/ })).toHaveAttribute(
      'href',
      '/properties/id-15528 E Golden Eagle Blvd',
    );
  });

  it('S1.2 shows an empty state with a way to add a property', async () => {
    server.use(serveProperties([]));

    renderRoute('/');

    expect(await screen.findByText('No properties yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a property' })).toHaveAttribute(
      'href',
      '/properties/new',
    );
  });

  it('S1.1 shows a loading state, then an error with retry when the query fails', async () => {
    server.use(
      graphql.query('Properties', () => HttpResponse.json({ errors: [{ message: 'boom' }] })),
    );
    const user = userEvent.setup();
    renderRoute('/');

    expect(screen.getByRole('status', { name: 'Loading properties' })).toBeInTheDocument();
    expect(await screen.findByText('Could not load properties')).toBeInTheDocument();

    server.use(serveProperties([property('1 Main St')]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('1 Main St')).toBeInTheDocument();
  });

  it('S2.4 shows "Newest first" by default and re-queries oldest first on toggle', async () => {
    const calls: PropertiesQueryVariables[] = [];
    server.use(serveProperties([property('C'), property('B'), property('A')], calls));
    const user = userEvent.setup();
    renderRoute('/');

    const toggle = await screen.findByRole('button', { name: /Newest first/ });
    await screen.findByText('C');
    expect(listedStreets()).toEqual(['C', 'B', 'A']);

    await user.click(toggle);

    expect(await screen.findByRole('button', { name: /Oldest first/ })).toBeInTheDocument();
    await screen.findByText('A');
    expect(listedStreets()).toEqual(['A', 'B', 'C']);
    expect(calls.map((v) => v.orderBy?.createdAt)).toEqual(['DESC', 'ASC']);
  });

  it('S1.1 serves a revisited list from the cache instead of re-querying', async () => {
    const calls: PropertiesQueryVariables[] = [];
    server.use(
      serveProperties([property('A', { id: 'property-1' })], calls),
      serveProperty([detailedProperty({ id: 'property-1', street: 'A' })]),
    );
    const user = userEvent.setup();
    renderRoute('/');

    await user.click(await screen.findByRole('link', { name: /^A/ }));
    await screen.findByRole('heading', { name: 'A' });
    await user.click(screen.getByRole('link', { name: 'All properties' }));

    await screen.findByRole('list', { name: 'Properties' });
    expect(calls).toHaveLength(1);
  });

  it('S5.8 includes a newly created property when returning to the list', async () => {
    const rows: Property[] = [];
    server.use(
      serveProperties(rows),
      serveProperty([detailedProperty({ id: 'new-id', street: '15528 E Golden Eagle Blvd' })]),
      graphql.mutation<CreatePropertyMutation, CreatePropertyMutationVariables>(
        'CreateProperty',
        ({ variables }) => {
          const created = property(variables.input.street, { id: 'new-id' });
          rows.unshift(created);
          return HttpResponse.json({
            data: {
              __typename: 'Mutation',
              createProperty: {
                __typename: 'CreatePropertySuccess',
                property: { __typename: 'Property', id: created.id },
              },
            },
          });
        },
      ),
    );
    const user = userEvent.setup();
    renderRoute('/');
    await screen.findByText('No properties yet');

    await user.click(screen.getByRole('link', { name: 'New property' }));
    await user.type(await screen.findByLabelText('Street'), '15528 E Golden Eagle Blvd');
    await user.type(screen.getByLabelText('City'), 'Fountain Hills');
    await user.selectOptions(screen.getByLabelText('State'), 'AZ');
    await user.type(screen.getByLabelText('Zip code'), '85268');
    await user.click(screen.getByRole('button', { name: 'Create property' }));
    await screen.findByRole('heading', { name: '15528 E Golden Eagle Blvd' });
    await user.click(screen.getByRole('link', { name: 'Covertree properties' }));

    const list = await screen.findByRole('list', { name: 'Properties' });
    expect(within(list).getByText('15528 E Golden Eagle Blvd')).toBeInTheDocument();
  });

  it('restores filters and sort from the URL and queries with them', async () => {
    const calls: PropertiesQueryVariables[] = [];
    server.use(serveProperties([property('1 Main St')], calls));

    renderRoute('/?city=hills&zip=85268&state=AZ&sort=oldest');

    await screen.findByText('1 Main St');
    expect(calls.at(-1)).toEqual({
      filter: { city: 'hills', zipCode: '85268', state: 'AZ' },
      orderBy: { createdAt: 'ASC' },
    });
    expect(screen.getByLabelText('City')).toHaveValue('hills');
    expect(screen.getByLabelText('Zip code')).toHaveValue('85268');
    expect(screen.getByLabelText('State')).toHaveValue('AZ');
    expect(screen.getByRole('button', { name: /Oldest first/ })).toBeInTheDocument();
  });

  it('ignores an invalid zip or state in the URL instead of failing the query', async () => {
    const calls: PropertiesQueryVariables[] = [];
    server.use(serveProperties([property('1 Main St')], calls));

    renderRoute('/?zip=85A68&state=XX&sort=sideways');

    await screen.findByText('1 Main St');
    expect(calls.at(-1)).toEqual({
      filter: { city: null, zipCode: null, state: null },
      orderBy: { createdAt: 'DESC' },
    });
  });

  it('writes applied filters and the sort to the URL', async () => {
    server.use(serveProperties([property('1 Main St')]));
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    await screen.findByText('1 Main St');

    await user.type(screen.getByLabelText('City'), ' Hills ');
    await user.selectOptions(screen.getByLabelText('State'), 'AZ');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: /Newest first/ }));

    expect(router.state.location.search).toBe('?city=Hills&state=AZ&sort=oldest');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(router.state.location.search).toBe('?sort=oldest');
  });

  it('returns from a property to the same filtered list', async () => {
    server.use(
      serveProperties([property('1 Main St', { id: 'property-1' })]),
      serveProperty([detailedProperty({ street: '1 Main St' })]),
    );
    const user = userEvent.setup();
    const { router } = renderRoute('/?city=hills');

    await user.click(await screen.findByRole('link', { name: /1 Main St/ }));
    await user.click(await screen.findByRole('link', { name: 'All properties' }));

    expect(router.state.location.search).toBe('?city=hills');
    expect(await screen.findByLabelText('City')).toHaveValue('hills');
  });
});
