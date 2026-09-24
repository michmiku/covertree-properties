import { Link } from 'react-router';

/** Property list lands here with S1–S3. */
export function HomeRoute() {
  return (
    <section className="grid gap-2">
      <h1 className="font-heading text-2xl font-semibold">Properties</h1>
      <p className="text-muted-foreground">
        <Link to="/properties/new" className="underline">
          Add a property
        </Link>{' '}
        to record it with its current weather.
      </p>
    </section>
  );
}
