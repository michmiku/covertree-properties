import { screen, within } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import { detailedProperty, serveProperty } from '@/test/properties';
import { renderRoute } from '@/test/render';

/** The `<dd>` that follows the `<dt>` labelled `term`. */
const valueOf = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling;

describe('property details', () => {
  it('S4.4 shows the address, coordinates and key weather fields with UTC observation time', async () => {
    server.use(
      serveProperty([
        detailedProperty({
          weatherData: {
            ...detailedProperty().weatherData,
            weatherDescriptions: ['Partly cloudy'],
          },
        }),
      ]),
    );

    renderRoute('/properties/property-1');

    expect(
      await screen.findByRole('heading', { level: 1, name: '15528 E Golden Eagle Blvd' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fountain Hills, AZ 85268')).toBeInTheDocument();
    expect(valueOf('Latitude')).toHaveTextContent('33.609');
    expect(valueOf('Longitude')).toHaveTextContent('-111.729');

    const weather = screen.getByRole('region', { name: 'Weather when recorded' });
    expect(within(weather).getByText('79°F')).toBeInTheDocument();
    expect(within(weather).getByText('Partly cloudy')).toBeInTheDocument();
    expect(within(weather).getByRole('presentation')).toHaveAttribute(
      'src',
      'https://cdn.example/overcast.png',
    );
    expect(within(weather).getByText('81°F')).toBeInTheDocument();
    expect(within(weather).getByText('42%')).toBeInTheDocument();
    expect(within(weather).getByText('6 mph NE')).toBeInTheDocument();
    expect(within(weather).getByText(/Observed at 10:35 AM UTC/)).toBeInTheDocument();
  });

  it('S4.2 shows "not found" when the property does not exist', async () => {
    server.use(serveProperty([]));

    renderRoute('/properties/missing');

    expect(await screen.findByText('Property not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to properties' })).toHaveAttribute('href', '/');
  });

  it('shows a loading state, then an error with retry when the details query fails', async () => {
    server.use(
      graphql.query('Property', () => HttpResponse.json({ errors: [{ message: 'boom' }] })),
    );

    renderRoute('/properties/property-1');

    expect(screen.getByRole('status', { name: 'Loading property' })).toBeInTheDocument();
    expect(await screen.findByText('Could not load this property')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
