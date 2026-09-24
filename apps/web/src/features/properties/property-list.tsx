import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { Link } from 'react-router';
import { ArrowDownUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SortDirection, type PropertiesQuery as PropertiesResult } from '@/gql/graphql';
import { PropertiesQuery } from './properties.query';
import {
  isFiltering,
  NO_FILTER,
  PropertyFilters,
  toPropertyFilter,
  type FilterValues,
} from './property-filters';

type Property = PropertiesResult['properties'][number];

const SORT_LABEL: Record<SortDirection, string> = {
  DESC: 'Newest first',
  ASC: 'Oldest first',
};

const createdAtFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** S1 list with the S2 sort toggle and S3 filters. */
export function PropertyList() {
  const [direction, setDirection] = useState<SortDirection>(SortDirection.DESC);
  const [filter, setFilter] = useState<FilterValues>(NO_FILTER);
  const { data, error, loading, refetch } = useQuery(PropertiesQuery, {
    variables: { filter: toPropertyFilter(filter), orderBy: { createdAt: direction } },
    // The list is unmounted while a property is created, so a named refetch would miss it.
    // Showing the cache and re-fetching on every mount keeps it current (S5.8).
    fetchPolicy: 'cache-and-network',
  });
  const properties = data?.properties;

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold">Properties</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDirection((d) => (d === SortDirection.DESC ? SortDirection.ASC : SortDirection.DESC))
          }
          aria-label={`Sorted by creation date: ${SORT_LABEL[direction]}. Change order`}
        >
          <ArrowDownUp />
          {SORT_LABEL[direction]}
        </Button>
      </div>

      <PropertyFilters applied={filter} onApply={setFilter} />

      {error && !properties ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load properties</AlertTitle>
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
      ) : !properties && loading ? (
        <p className="text-muted-foreground" role="status">
          Loading properties…
        </p>
      ) : properties?.length === 0 && isFiltering(filter) ? (
        <Card>
          <CardContent className="grid justify-items-center gap-2 py-8 text-center">
            <p className="font-medium">No properties match these filters</p>
            <Button variant="outline" size="sm" onClick={() => setFilter(NO_FILTER)}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : properties?.length === 0 ? (
        <Card>
          <CardContent className="grid gap-2 py-8 text-center">
            <p className="font-medium">No properties yet</p>
            <p className="text-muted-foreground">
              <Link to="/properties/new" className="underline">
                Add a property
              </Link>{' '}
              to record it with its current weather.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Properties">
          {properties?.map((property) => (
            <li key={property.id}>
              <PropertyRow property={property} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PropertyRow({ property }: { property: Property }) {
  const description = property.weatherData.weatherDescriptions.join(', ');
  const icon = property.weatherData.weatherIcons[0];
  return (
    <Link
      to={`/properties/${property.id}`}
      className="block rounded-xl ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:outline-2"
    >
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="grid gap-0.5">
          <span className="font-medium">{property.street}</span>
          <span className="text-sm text-muted-foreground">
            {property.city}, {property.state} {property.zipCode}
          </span>
          <span className="text-xs text-muted-foreground">
            Added {createdAtFormat.format(new Date(property.createdAt))}
          </span>
        </div>
        <div className="flex items-center gap-2 text-right">
          {icon && <img src={icon} alt="" className="size-8 rounded" />}
          <div className="grid">
            <span className="font-medium">{property.weatherData.temperature}°F</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
