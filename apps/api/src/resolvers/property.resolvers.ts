import type {
  Resolvers,
  ResolversTypes,
  WeatherFailureReason,
} from '../__generated__/resolvers-types.ts';

const WEATHER_MESSAGES: Record<WeatherFailureReason, string> = {
  NETWORK: 'Could not reach the weather service. The property was not created.',
  TIMEOUT: 'The weather service did not respond in time. The property was not created.',
  HTTP_ERROR: 'The weather service returned an error. The property was not created.',
  UPSTREAM_ERROR: 'The weather service rejected the request. The property was not created.',
  INVALID_RESPONSE: 'The weather service returned unusable data. The property was not created.',
  LOCATION_MISMATCH:
    'The weather service resolved this zip code outside the USA. The property was not created.',
};

export const propertyResolvers: Resolvers = {
  Mutation: {
    async createProperty(_parent, { input }, { services }) {
      const result = await services.createProperty(input);
      switch (result.kind) {
        case 'created':
          return { __typename: 'CreatePropertySuccess', property: result.property };
        case 'invalidInput':
          return {
            __typename: 'InvalidInputError',
            message: 'Some fields are invalid.',
            fieldErrors: result.fieldErrors,
          };
        case 'duplicate':
          return {
            __typename: 'DuplicatePropertyError',
            message: 'A property with this address already exists.',
            existingPropertyId: result.existingPropertyId,
          };
        case 'weatherUnavailable':
          return {
            __typename: 'WeatherUnavailableError',
            message: WEATHER_MESSAGES[result.reason],
            reason: result.reason,
          };
      }
    },
  },

  Property: {
    // Stored as the validated Weatherstack `current` object (snake_case), see create-property service.
    weatherData: (property) => property.weatherData as unknown as ResolversTypes['Weather'],
  },

  Weather: {
    observationTime: (w) => w.observation_time,
    feelsLike: (w) => w.feelslike,
    weatherCode: (w) => w.weather_code ?? null,
    weatherDescriptions: (w) => w.weather_descriptions.map((text) => text.trim()),
    weatherIcons: (w) => w.weather_icons,
    windSpeed: (w) => w.wind_speed,
    windDegree: (w) => w.wind_degree ?? null,
    windDir: (w) => w.wind_dir,
    uvIndex: (w) => w.uv_index ?? null,
    isDay: (w) => (w.is_day === undefined ? null : w.is_day === 'yes'),
  },
};
