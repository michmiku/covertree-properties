import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { PropertiesQuery, PropertiesQueryVariables } from '@/gql/graphql';
import { server } from '@/test/msw';
import { renderRoute } from '@/test/render';

type Property = PropertiesQuery['properties'][number];

const property = (street: string, city: string, state: Property['state'], zipCode: string) =>
  ({
    __typename: 'Property',
    id: `id-${street}`,
    street,
    city,
    state,
    zipCode,
    createdAt: '2026-09-24T10:53:08.106Z',
    weatherData: {
      __typename: 'Weather',
      temperature: 79,
      weatherDescriptions: ['Overcast'],
      weatherIcons: [],
    },
  }) satisfies Property;

const ROWS = [
  property('15528 E Golden Eagle Blvd', 'Fountain Hills', 'AZ', '85268'),
  property('1 Main St', 'San Juan', 'PR', '00901'),
];

/** A tiny stand-in for the server's S3 semantics, recording every request's variables. */
function serveFiltered(calls: PropertiesQueryVariables[]) {
  return graphql.query<PropertiesQuery, PropertiesQueryVariables>('Properties', ({ variables }) => {
    calls.push(variables);
    const f = variables.filter ?? {};
    const rows = ROWS.filter(
      (p) =>
        (!f.city || p.city.toLowerCase().includes(f.city.toLowerCase())) &&
        (!f.zipCode || p.zipCode === f.zipCode) &&
        (!f.state || p.state === f.state),
    );
    return HttpResponse.json({ data: { __typename: 'Query', properties: rows } });
  });
}

async function setup() {
  const calls: PropertiesQueryVariables[] = [];
  server.use(serveFiltered(calls));
  const user = userEvent.setup();
  renderRoute('/');
  await screen.findByText('1 Main St');
  return { user, calls };
}

describe('property filters', () => {
  it('S3.1 sends the combined filter on Apply and shows only matches', async () => {
    const { user, calls } = await setup();

    await user.type(screen.getByLabelText('City'), '  fountain ');
    await user.selectOptions(screen.getByLabelText('State'), 'AZ');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(screen.queryByText('1 Main St')).not.toBeInTheDocument());
    expect(screen.getByText('15528 E Golden Eagle Blvd')).toBeInTheDocument();
    expect(calls.at(-1)?.filter).toEqual({ city: 'fountain', zipCode: null, state: 'AZ' });
  });

  it('S3.4 sends blank fields as no constraint', async () => {
    const { calls } = await setup();

    expect(calls[0]?.filter).toEqual({ city: null, zipCode: null, state: null });
  });

  it('S3.6 rejects a partial zip code client-side without querying', async () => {
    const { user, calls } = await setup();
    const before = calls.length;

    await user.type(screen.getByLabelText('Zip code'), '852');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Zip code must be exactly 5 digits.')).toBeInTheDocument();
    expect(screen.getByLabelText('Zip code')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(before);
  });

  it('S3.4 Clear resets typed but unapplied inputs and the zip error', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('City'), 'abc');
    await user.type(screen.getByLabelText('Zip code'), '123');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Zip code must be exactly 5 digits.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByLabelText('City')).toHaveValue('');
    expect(screen.getByLabelText('Zip code')).toHaveValue('');
    expect(screen.queryByText('Zip code must be exactly 5 digits.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('S3.5 applies an exact zip code with Enter', async () => {
    const { user, calls } = await setup();

    await user.type(screen.getByLabelText('Zip code'), '00901{Enter}');

    await waitFor(() =>
      expect(screen.queryByText('15528 E Golden Eagle Blvd')).not.toBeInTheDocument(),
    );
    expect(calls.at(-1)?.filter?.zipCode).toBe('00901');
  });

  it('S3.8 keeps the filter when the sort order changes', async () => {
    const { user, calls } = await setup();

    await user.selectOptions(screen.getByLabelText('State'), 'PR');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: /Newest first/ }));

    await screen.findByRole('button', { name: /Oldest first/ });
    expect(calls.at(-1)).toEqual({
      filter: { city: null, zipCode: null, state: 'PR' },
      orderBy: { createdAt: 'ASC' },
    });
  });

  it('S3.10 shows "no matches" and clears the filters from there', async () => {
    const { user, calls } = await setup();

    await user.type(screen.getByLabelText('City'), 'Phoenix');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('No properties match these filters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toHaveValue('');
    expect(calls.at(-1)?.filter).toEqual({ city: null, zipCode: null, state: null });
  });
});
