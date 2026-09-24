import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { CreatePropertyMutation, CreatePropertyMutationVariables } from '@/gql/graphql';
import { server } from '@/test/msw';
import { detailedProperty, serveProperty } from '@/test/properties';
import { renderRoute } from '@/test/render';

type Result = CreatePropertyMutation['createProperty'];

/** Answers CreateProperty with `result` and records the variables it received. */
function respondWith(result: Result, calls: CreatePropertyMutationVariables[] = [], wait = 0) {
  return graphql.mutation<CreatePropertyMutation, CreatePropertyMutationVariables>(
    'CreateProperty',
    async ({ variables }) => {
      calls.push(variables);
      if (wait) await delay(wait);
      return HttpResponse.json({ data: { __typename: 'Mutation', createProperty: result } });
    },
  );
}

const SUCCESS: Result = {
  __typename: 'CreatePropertySuccess',
  property: { __typename: 'Property', id: 'new-id' },
};

async function fillForm({
  street = '15528 E Golden Eagle Blvd',
  city = 'Fountain Hills',
  state = 'AZ',
  zipCode = '85268',
} = {}) {
  const user = userEvent.setup();
  renderRoute('/properties/new');
  if (street) await user.type(screen.getByLabelText('Street'), street);
  if (city) await user.type(screen.getByLabelText('City'), city);
  if (state) await user.selectOptions(screen.getByLabelText('State'), state);
  if (zipCode) await user.type(screen.getByLabelText('Zip code'), zipCode);
  return {
    user,
    submit: () => user.click(screen.getByRole('button', { name: 'Create property' })),
  };
}

describe('S5.8 create property form', () => {
  it('S5.8 shows field errors client-side and sends nothing', async () => {
    // No handler: a request would fail the test via onUnhandledRequest.
    const { submit } = await fillForm({ street: '', city: '   ', state: '', zipCode: '85A' });

    await submit();

    expect(screen.getByText('Street is required.')).toBeInTheDocument();
    expect(screen.getByText('City is required.')).toBeInTheDocument();
    expect(screen.getByText('State is required.')).toBeInTheDocument();
    expect(screen.getByText('Zip code must be exactly 5 digits.')).toBeInTheDocument();
    expect(screen.getByLabelText('Zip code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('S5.8 rejects over-length street and city client-side', async () => {
    const { submit } = await fillForm({ street: 'x'.repeat(201), city: 'y'.repeat(101) });

    await submit();

    expect(screen.getByText('Street must be at most 200 characters.')).toBeInTheDocument();
    expect(screen.getByText('City must be at most 100 characters.')).toBeInTheDocument();
  });

  it('S5.8 disables submit while pending', async () => {
    server.use(respondWith(SUCCESS, [], 200), serveProperty([detailedProperty({ id: 'new-id' })]));
    const { submit } = await fillForm();

    void submit();

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    // Let the create finish here: its toast lives in Sonner's global store and would otherwise
    // land in the next test.
    expect(await screen.findByText('Property created')).toBeInTheDocument();
  });

  it('S5.8 sends the input and navigates to the new property on success', async () => {
    const calls: CreatePropertyMutationVariables[] = [];
    server.use(
      respondWith(SUCCESS, calls),
      serveProperty([detailedProperty({ id: 'new-id', street: '15528 E Golden Eagle Blvd' })]),
    );
    const { submit } = await fillForm();

    await submit();

    expect(
      await screen.findByRole('heading', { name: '15528 E Golden Eagle Blvd' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Property created')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        input: {
          street: '15528 E Golden Eagle Blvd',
          city: 'Fountain Hills',
          state: 'AZ',
          zipCode: '85268',
        },
      },
    ]);
  });

  it('S5.8 shows server field errors next to the field', async () => {
    server.use(
      respondWith({
        __typename: 'InvalidInputError',
        message: 'Some fields are invalid.',
        fieldErrors: [
          {
            __typename: 'FieldError',
            field: 'city',
            message: 'City must be at most 100 characters.',
          },
        ],
      }),
    );
    const { submit } = await fillForm();

    await submit();

    expect(await screen.findByText('City must be at most 100 characters.')).toBeInTheDocument();
  });

  it('S5.8 links to the existing property on duplicate', async () => {
    server.use(
      respondWith({
        __typename: 'DuplicatePropertyError',
        message: 'A property with this address already exists.',
        existingPropertyId: 'existing-id',
      }),
    );
    const { submit } = await fillForm();

    await submit();

    expect(
      await screen.findByText('A property with this address already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the existing property' })).toHaveAttribute(
      'href',
      '/properties/existing-id',
    );
  });

  it('S5.8 shows weather unavailable and keeps the form values', async () => {
    server.use(
      respondWith({
        __typename: 'WeatherUnavailableError',
        message: 'The weather service did not respond in time. The property was not created.',
        reason: 'TIMEOUT',
      }),
    );
    const { submit } = await fillForm();

    await submit();

    expect(
      await screen.findByText('Weather data unavailable, property not created'),
    ).toBeInTheDocument();
    expect(screen.getByText(/did not respond in time/)).toBeInTheDocument();
    expect(screen.getByLabelText('Street')).toHaveValue('15528 E Golden Eagle Blvd');
    expect(screen.getByLabelText('Zip code')).toHaveValue('85268');
    expect(screen.getByRole('button', { name: 'Create property' })).toBeEnabled();
  });

  it('S5.8 shows a generic error when the server cannot be reached', async () => {
    server.use(graphql.mutation('CreateProperty', () => HttpResponse.error()));
    const { submit } = await fillForm();

    await submit();

    await waitFor(() =>
      expect(screen.getByText('Could not reach the server. Please try again.')).toBeInTheDocument(),
    );
  });
});
