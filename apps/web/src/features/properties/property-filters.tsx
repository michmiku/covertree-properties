import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { USState, type PropertyFilter } from '@/gql/graphql';

const STATES = Object.values(USState);

export interface FilterValues {
  city: string;
  zipCode: string;
  state: string;
}

export const NO_FILTER: FilterValues = { city: '', zipCode: '', state: '' };

/** Blank fields mean "any" (S3.4); the server trims and validates again. */
export function toPropertyFilter({ city, zipCode, state }: FilterValues): PropertyFilter {
  return {
    city: city.trim() || null,
    zipCode: zipCode.trim() || null,
    state: (state as USState) || null,
  };
}

const sameFilter = (a: FilterValues, b: FilterValues) =>
  a.city === b.city && a.zipCode === b.zipCode && a.state === b.state;

export const isFiltering = (values: FilterValues) =>
  Object.values(toPropertyFilter(values)).some((value) => value !== null);

/** S3 — filters apply on submit, so a half-typed zip never reaches the API. */
export function PropertyFilters({
  applied,
  onApply,
}: {
  applied: FilterValues;
  onApply: (values: FilterValues) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [zipError, setZipError] = useState<string>();
  const [prevApplied, setPrevApplied] = useState(applied);

  // Keep the inputs in sync when filters change from outside: the "no matches" clear button, or
  // the URL (back/forward). Compared by value, since `applied` is re-read from the URL each render.
  if (!sameFilter(applied, prevApplied)) {
    setPrevApplied(applied);
    setDraft(applied);
    setZipError(undefined);
  }

  const update = (field: keyof FilterValues) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zip = draft.zipCode.trim();
    if (zip && !/^\d{5}$/.test(zip)) {
      setZipError('Zip code must be exactly 5 digits.');
      return;
    }
    setZipError(undefined);
    onApply(draft);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Filter properties"
      className="grid gap-3 rounded-xl p-4 ring-1 ring-foreground/10 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-start"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="filter-city">City</Label>
        <Input
          id="filter-city"
          value={draft.city}
          onChange={(e) => update('city')(e.target.value)}
          placeholder="Any city"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-zip">Zip code</Label>
        <Input
          id="filter-zip"
          value={draft.zipCode}
          onChange={(e) => update('zipCode')(e.target.value)}
          placeholder="Any"
          inputMode="numeric"
          maxLength={5}
          aria-invalid={!!zipError}
          aria-describedby={zipError ? 'filter-zip-error' : undefined}
        />
        {zipError && (
          <p id="filter-zip-error" className="text-sm text-destructive">
            {zipError}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-state">State</Label>
        <NativeSelect
          id="filter-state"
          value={draft.state}
          onChange={(e) => update('state')(e.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">Any</NativeSelectOption>
          {STATES.map((state) => (
            <NativeSelectOption key={state} value={state}>
              {state}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex gap-2 sm:pt-[1.375rem]">
        <Button type="submit">Apply</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onApply(NO_FILTER)}
          disabled={!isFiltering(applied) && !isFiltering(draft)}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
