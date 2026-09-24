import { z } from 'zod';

/** Weatherstack sends coordinates as strings (SPEC S5.5); accept numbers too, reject non-numeric. */
const coordinate = (min: number, max: number) =>
  z
    .union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number()])
    .transform(Number)
    .pipe(z.number().min(min).max(max));

/**
 * The `current` object. Fields the UI shows (S4.4) are required; the rest are optional so a
 * missing extra field doesn't block creation. Unknown keys are kept: it's stored as returned.
 */
export const WeatherstackCurrent = z.looseObject({
  observation_time: z.string(),
  temperature: z.number(),
  feelslike: z.number(),
  weather_descriptions: z.array(z.string()),
  weather_icons: z.array(z.string()),
  // GraphQL Int fields: a fraction would be stored, then fail serialization on every read.
  humidity: z.number().int(),
  wind_speed: z.number(),
  wind_dir: z.string(),
  weather_code: z.number().int().optional(),
  wind_degree: z.number().int().optional(),
  pressure: z.number().optional(),
  precip: z.number().optional(),
  cloudcover: z.number().int().optional(),
  uv_index: z.number().optional(),
  visibility: z.number().optional(),
  is_day: z.enum(['yes', 'no']).optional(),
});
export type WeatherstackCurrent = z.infer<typeof WeatherstackCurrent>;

export const WeatherstackLocation = z.looseObject({
  country: z.string(),
  region: z.string().optional(),
  name: z.string().optional(),
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
});
export type WeatherstackLocation = z.infer<typeof WeatherstackLocation>;

export const WeatherstackSuccess = z.looseObject({
  location: WeatherstackLocation,
  current: WeatherstackCurrent,
});
export type WeatherstackSuccess = z.infer<typeof WeatherstackSuccess>;

/** HTTP 200 can still be an error: `{ success: false, error: { code, type, info } }`. */
export const WeatherstackError = z.object({
  success: z.literal(false),
  error: z.looseObject({ code: z.number().optional(), type: z.string().optional() }).optional(),
});
