import { useParams } from 'react-router';

/** Details (address, coordinates, weather) land here with S4. */
export function PropertyRoute() {
  const { id } = useParams();
  return (
    <section className="grid gap-2">
      <h1 className="font-heading text-2xl font-semibold">Property</h1>
      <p className="font-mono text-sm text-muted-foreground">{id}</p>
    </section>
  );
}
