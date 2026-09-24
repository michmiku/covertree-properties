import { useState, type FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { Link, useNavigate } from 'react-router';
import { CloudOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { USState } from '@/gql/graphql';
import { CreatePropertyMutation } from './create-property.mutation';
import {
  validateProperty,
  type PropertyFormErrors,
  type PropertyFormValues,
} from './validate-property';

const STATES = Object.values(USState);
const EMPTY: PropertyFormValues = { street: '', city: '', state: '', zipCode: '' };

type Notice =
  | { kind: 'weather'; message: string }
  | { kind: 'duplicate'; message: string; existingPropertyId: string }
  | { kind: 'error'; message: string };

/** S5.8 — create a property; every CreatePropertyResult member has a visible outcome. */
export function CreatePropertyForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<PropertyFormErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createProperty, { loading }] = useMutation(CreatePropertyMutation);

  const update = (field: keyof PropertyFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const clientErrors = validateProperty(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    try {
      const { data } = await createProperty({
        variables: { input: { ...values, state: values.state as USState } },
      });
      const result = data?.createProperty;
      switch (result?.__typename) {
        case 'CreatePropertySuccess':
          await navigate(`/properties/${result.property.id}`);
          return;
        case 'InvalidInputError':
          setErrors(
            Object.fromEntries(result.fieldErrors.map(({ field, message }) => [field, message])),
          );
          return;
        case 'DuplicatePropertyError':
          setNotice({ kind: 'duplicate', ...result });
          return;
        case 'WeatherUnavailableError':
          setNotice({ kind: 'weather', message: result.message });
          return;
        default:
          setNotice({ kind: 'error', message: 'Unexpected response from the server.' });
      }
    } catch {
      setNotice({ kind: 'error', message: 'Could not reach the server. Please try again.' });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {notice && <NoticeAlert notice={notice} />}

      <Field id="street" label="Street" error={errors.street}>
        <Input
          id="street"
          value={values.street}
          onChange={(e) => update('street')(e.target.value)}
          placeholder="15528 E Golden Eagle Blvd"
          aria-invalid={!!errors.street}
          aria-describedby={errors.street ? 'street-error' : undefined}
        />
      </Field>

      <Field id="city" label="City" error={errors.city}>
        <Input
          id="city"
          value={values.city}
          onChange={(e) => update('city')(e.target.value)}
          placeholder="Fountain Hills"
          aria-invalid={!!errors.city}
          aria-describedby={errors.city ? 'city-error' : undefined}
        />
      </Field>

      <div className="grid grid-cols-2 items-start gap-4">
        <Field id="state" label="State" error={errors.state}>
          <NativeSelect
            id="state"
            value={values.state}
            onChange={(e) => update('state')(e.target.value)}
            aria-invalid={!!errors.state}
            aria-describedby={errors.state ? 'state-error' : undefined}
            className="w-full"
          >
            <NativeSelectOption value="">Select…</NativeSelectOption>
            {STATES.map((state) => (
              <NativeSelectOption key={state} value={state}>
                {state}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field id="zipCode" label="Zip code" error={errors.zipCode}>
          <Input
            id="zipCode"
            value={values.zipCode}
            onChange={(e) => update('zipCode')(e.target.value)}
            placeholder="85268"
            inputMode="numeric"
            maxLength={5}
            aria-invalid={!!errors.zipCode}
            aria-describedby={errors.zipCode ? 'zipCode-error' : undefined}
          />
        </Field>
      </div>

      <Button type="submit" disabled={loading} className="justify-self-start">
        {loading ? 'Creating…' : 'Create property'}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NoticeAlert({ notice }: { notice: Notice }) {
  if (notice.kind === 'weather') {
    return (
      <Alert variant="destructive">
        <CloudOff />
        <AlertTitle>Weather data unavailable, property not created</AlertTitle>
        <AlertDescription>{notice.message}</AlertDescription>
      </Alert>
    );
  }
  if (notice.kind === 'duplicate') {
    return (
      <Alert>
        <AlertTitle>{notice.message}</AlertTitle>
        <AlertDescription>
          <Link to={`/properties/${notice.existingPropertyId}`} className="underline">
            View the existing property
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{notice.message}</AlertDescription>
    </Alert>
  );
}
