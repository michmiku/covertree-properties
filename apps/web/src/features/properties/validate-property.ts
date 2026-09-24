/** Fields of the create form. `state` is '' until the user picks one. */
export interface PropertyFormValues {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export type PropertyFormErrors = Partial<Record<keyof PropertyFormValues, string>>;

/**
 * Mirrors the server rules (SPEC S5.3) so users get instant feedback; the server stays the
 * source of truth and its InvalidInputError is shown the same way.
 */
export function validateProperty(values: PropertyFormValues): PropertyFormErrors {
  const errors: PropertyFormErrors = {};
  const street = values.street.trim();
  const city = values.city.trim();

  if (!street) errors.street = 'Street is required.';
  else if (street.length > 200) errors.street = 'Street must be at most 200 characters.';

  if (!city) errors.city = 'City is required.';
  else if (city.length > 100) errors.city = 'City must be at most 100 characters.';

  if (!values.state) errors.state = 'State is required.';

  if (!/^\d{5}$/.test(values.zipCode)) errors.zipCode = 'Zip code must be exactly 5 digits.';

  return errors;
}
