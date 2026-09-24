import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type {
  DeletePropertyMutation,
  DeletePropertyMutationVariables,
  PropertiesQuery,
} from '@/gql/graphql';
import { server } from '@/test/msw';
import { detailedProperty, serveProperty, type DetailedProperty } from '@/test/properties';
import { renderRoute } from '@/test/render';

/** In-memory backend for the list, detail and delete operations, sharing one set of rows. */
function serveBackend(rows: DetailedProperty[], deleted: string[] = []) {
  return [
    graphql.query<PropertiesQuery>('Properties', () =>
      HttpResponse.json({ data: { __typename: 'Query', properties: rows } }),
    ),
    serveProperty(rows),
    graphql.mutation<DeletePropertyMutation, DeletePropertyMutationVariables>(
      'DeleteProperty',
      ({ variables }) => {
        const id = String(variables.id);
        const index = rows.findIndex((row) => row.id === id);
        deleted.push(id);
        if (index === -1) {
          return HttpResponse.json({
            data: {
              __typename: 'Mutation',
              deleteProperty: {
                __typename: 'PropertyNotFoundError',
                message: 'Property not found.',
                id,
              },
            },
          });
        }
        rows.splice(index, 1);
        return HttpResponse.json({
          data: {
            __typename: 'Mutation',
            deleteProperty: { __typename: 'DeletePropertySuccess', id },
          },
        });
      },
    ),
  ];
}

async function openDeleteDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  return { user, dialog: await screen.findByRole('alertdialog') };
}

describe('delete property', () => {
  it('S6.6 asks for confirmation and deletes nothing when cancelled', async () => {
    const deleted: string[] = [];
    server.use(...serveBackend([detailedProperty()], deleted));
    renderRoute('/properties/property-1');

    const { user, dialog } = await openDeleteDialog();

    expect(within(dialog).getByText('Delete this property?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/15528 E Golden Eagle Blvd, Fountain Hills, AZ 85268/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep property' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it('S6.6 removes the property from the list and its detail route shows "not found"', async () => {
    const rows = [detailedProperty(), detailedProperty({ id: 'property-2', street: '1 Main St' })];
    const deleted: string[] = [];
    server.use(...serveBackend(rows, deleted));
    const { router } = renderRoute('/properties/property-1');

    const { user, dialog } = await openDeleteDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Delete property' }));

    const list = await screen.findByRole('list', { name: 'Properties' });
    expect(within(list).getByText('1 Main St')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(within(list).queryByText('15528 E Golden Eagle Blvd')).not.toBeInTheDocument();
    expect(deleted).toEqual(['property-1']);

    await router.navigate('/properties/property-1');

    expect(await screen.findByText('Property not found')).toBeInTheDocument();
  });

  it('S6.6 treats an already-deleted property as gone and returns to the list', async () => {
    const rows = [detailedProperty()];
    server.use(...serveBackend(rows));
    const { router } = renderRoute('/properties/property-1');
    await screen.findByRole('heading', { name: '15528 E Golden Eagle Blvd' });
    rows.length = 0; // deleted elsewhere after the page loaded

    const { user, dialog } = await openDeleteDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Delete property' }));

    expect(await screen.findByText('No properties yet')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('S6.6 keeps the dialog open with an error when the server cannot be reached', async () => {
    // First matching handler wins, so the failure overrides the backend's DeleteProperty.
    server.use(
      graphql.mutation('DeleteProperty', () => HttpResponse.error()),
      ...serveBackend([detailedProperty()]),
    );
    const { router } = renderRoute('/properties/property-1');

    const { user, dialog } = await openDeleteDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Delete property' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not reach the server. The property was not deleted.',
    );
    expect(router.state.location.pathname).toBe('/properties/property-1');
  });
});
