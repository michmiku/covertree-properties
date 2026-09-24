/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type CreatePropertyInput = {
  /** Trimmed, 1–100 chars. */
  city: string;
  state: USState;
  /** Trimmed, 1–200 chars. */
  street: string;
  /** Exactly 5 digits. */
  zipCode: string;
};

/** S3 — all fields optional; provided fields are AND-ed. Omitted, null or blank = no constraint. */
export type PropertyFilter = {
  /** Case-insensitive substring; `%` and `_` match literally (S3.2–S3.4). */
  city?: string | null | undefined;
  state?: USState | null | undefined;
  /** Exact match. Blank = any (S3.4); otherwise exactly 5 digits or BAD_USER_INPUT (S3.5, S3.6). */
  zipCode?: string | null | undefined;
};

/** S2 — ties on createdAt are broken by id in the same direction (S2.3). */
export type PropertyOrderBy = {
  createdAt?: SortDirection | null | undefined;
};

export const SortDirection = {
  ASC: 'ASC',
  DESC: 'DESC'
} as const;

export type SortDirection = typeof SortDirection[keyof typeof SortDirection];
/** US states, DC and inhabited territories (SPEC Decisions: Allowed states). */
export const USState = {
  AK: 'AK',
  AL: 'AL',
  AR: 'AR',
  AS: 'AS',
  AZ: 'AZ',
  CA: 'CA',
  CO: 'CO',
  CT: 'CT',
  DC: 'DC',
  DE: 'DE',
  FL: 'FL',
  GA: 'GA',
  GU: 'GU',
  HI: 'HI',
  IA: 'IA',
  ID: 'ID',
  IL: 'IL',
  IN: 'IN',
  KS: 'KS',
  KY: 'KY',
  LA: 'LA',
  MA: 'MA',
  MD: 'MD',
  ME: 'ME',
  MI: 'MI',
  MN: 'MN',
  MO: 'MO',
  MP: 'MP',
  MS: 'MS',
  MT: 'MT',
  NC: 'NC',
  ND: 'ND',
  NE: 'NE',
  NH: 'NH',
  NJ: 'NJ',
  NM: 'NM',
  NV: 'NV',
  NY: 'NY',
  OH: 'OH',
  OK: 'OK',
  OR: 'OR',
  PA: 'PA',
  PR: 'PR',
  RI: 'RI',
  SC: 'SC',
  SD: 'SD',
  TN: 'TN',
  TX: 'TX',
  UT: 'UT',
  VA: 'VA',
  VI: 'VI',
  VT: 'VT',
  WA: 'WA',
  WI: 'WI',
  WV: 'WV',
  WY: 'WY'
} as const;

export type USState = typeof USState[keyof typeof USState];
export const WeatherFailureReason = {
  /** Non-2xx status. */
  HTTP_ERROR: 'HTTP_ERROR',
  /** Body failed schema validation, incl. unparsable or out-of-range lat/lon. */
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  /** Resolved country is not the USA (S5.6). */
  LOCATION_MISMATCH: 'LOCATION_MISMATCH',
  /** Connection refused, DNS failure, reset. */
  NETWORK: 'NETWORK',
  /** No response within 5 s. */
  TIMEOUT: 'TIMEOUT',
  /** HTTP 200 with `{ success: false, error }`. */
  UPSTREAM_ERROR: 'UPSTREAM_ERROR'
} as const;

export type WeatherFailureReason = typeof WeatherFailureReason[keyof typeof WeatherFailureReason];
export type CreatePropertyMutationVariables = Exact<{
  input: CreatePropertyInput;
}>;


export type CreatePropertyMutation = { __typename: 'Mutation', createProperty:
    | { __typename: 'CreatePropertySuccess', property: { __typename: 'Property', id: string } }
    | { __typename: 'DuplicatePropertyError', message: string, existingPropertyId: string }
    | { __typename: 'InvalidInputError', message: string, fieldErrors: Array<{ __typename: 'FieldError', field: string, message: string }> }
    | { __typename: 'WeatherUnavailableError', message: string, reason: WeatherFailureReason }
   };

export type DeletePropertyMutationVariables = Exact<{
  id: string | number;
}>;


export type DeletePropertyMutation = { __typename: 'Mutation', deleteProperty:
    | { __typename: 'DeletePropertySuccess', id: string }
    | { __typename: 'PropertyNotFoundError', message: string, id: string }
   };

export type PropertiesQueryVariables = Exact<{
  filter?: PropertyFilter | null | undefined;
  orderBy?: PropertyOrderBy | null | undefined;
}>;


export type PropertiesQuery = { __typename: 'Query', properties: Array<{ __typename: 'Property', id: string, street: string, city: string, state: USState, zipCode: string, createdAt: string, weatherData: { __typename: 'Weather', temperature: number, weatherDescriptions: Array<string>, weatherIcons: Array<string> } }> };

export type PropertyQueryVariables = Exact<{
  id: string | number;
}>;


export type PropertyQuery = { __typename: 'Query', property: { __typename: 'Property', id: string, street: string, city: string, state: USState, zipCode: string, lat: number, long: number, createdAt: string, weatherData: { __typename: 'Weather', observationTime: string, temperature: number, feelsLike: number, weatherDescriptions: Array<string>, weatherIcons: Array<string>, humidity: number, windSpeed: number, windDir: string } } | null };


export const CreatePropertyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateProperty"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePropertyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createProperty"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePropertySuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"property"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InvalidInputError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"fieldErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DuplicatePropertyError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"existingPropertyId"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WeatherUnavailableError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}}]}}]} as unknown as DocumentNode<CreatePropertyMutation, CreatePropertyMutationVariables>;
export const DeletePropertyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteProperty"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteProperty"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DeletePropertySuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PropertyNotFoundError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DeletePropertyMutation, DeletePropertyMutationVariables>;
export const PropertiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Properties"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PropertyFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"PropertyOrderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"properties"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"street"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"weatherData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"weatherDescriptions"}},{"kind":"Field","name":{"kind":"Name","value":"weatherIcons"}}]}}]}}]}}]} as unknown as DocumentNode<PropertiesQuery, PropertiesQueryVariables>;
export const PropertyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Property"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"property"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"street"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"zipCode"}},{"kind":"Field","name":{"kind":"Name","value":"lat"}},{"kind":"Field","name":{"kind":"Name","value":"long"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"weatherData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"observationTime"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"feelsLike"}},{"kind":"Field","name":{"kind":"Name","value":"weatherDescriptions"}},{"kind":"Field","name":{"kind":"Name","value":"weatherIcons"}},{"kind":"Field","name":{"kind":"Name","value":"humidity"}},{"kind":"Field","name":{"kind":"Name","value":"windSpeed"}},{"kind":"Field","name":{"kind":"Name","value":"windDir"}}]}}]}}]}}]} as unknown as DocumentNode<PropertyQuery, PropertyQueryVariables>;