import { useQuery } from '@apollo/client/react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PropertyQuery as PropertyResult } from '@/gql/graphql';
import { DeletePropertyButton } from './delete-property-button';
import { PropertyQuery } from './property.query';

type Property = NonNullable<PropertyResult['property']>;

const recordedFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** S4 — address, coordinates and the weather snapshot taken when the property was created. */
export function PropertyDetails({ id }: { id: string }) {
  const { data, error, loading, refetch } = useQuery(PropertyQuery, { variables: { id } });

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load this property</AlertTitle>
        <AlertDescription className="grid gap-2">
          <span>Check that the API is running, then try again.</span>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (loading && !data) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading property">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data?.property) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-2 py-8 text-center">
          <h1 className="font-medium">Property not found</h1>
          <p className="text-muted-foreground">It may have been deleted.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to properties</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <PropertyPanel property={data.property} />;
}

function PropertyPanel({ property }: { property: Property }) {
  const { weatherData: weather } = property;
  const location = `${property.city}, ${property.state} ${property.zipCode}`;
  const description = weather.weatherDescriptions.join(', ');
  const icon = weather.weatherIcons[0];

  return (
    <article className="grid gap-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 justify-self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All properties
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-2xl font-semibold text-balance">{property.street}</h1>
          <p className="text-muted-foreground">{location}</p>
          <dl className="flex gap-4 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Latitude</dt>
              <dd className="tabular-nums">{property.lat}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Longitude</dt>
              <dd className="tabular-nums">{property.long}</dd>
            </div>
          </dl>
        </div>
        <DeletePropertyButton id={property.id} address={`${property.street}, ${location}`} />
      </header>

      <section
        aria-labelledby="weather-heading"
        className="grid gap-4 rounded-xl p-5 ring-1 ring-foreground/10"
      >
        <div className="grid gap-0.5">
          <h2 id="weather-heading" className="font-medium">
            Weather when recorded
          </h2>
          <p className="text-sm text-muted-foreground">
            Added {recordedFormat.format(new Date(property.createdAt))}. Observed at{' '}
            {weather.observationTime} UTC. Not updated after creation.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {icon && <img src={icon} alt="" className="size-14 rounded-lg" />}
          <div className="grid">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {weather.temperature}°F
            </span>
            <span className="text-muted-foreground">{description}</span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Feels like</dt>
            <dd className="font-medium tabular-nums">{weather.feelsLike}°F</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Humidity</dt>
            <dd className="font-medium tabular-nums">{weather.humidity}%</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Wind</dt>
            <dd className="font-medium tabular-nums">
              {weather.windSpeed} mph {weather.windDir}
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
