import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { Property as PropertyModel } from './prisma/client.ts';
import type { WeatherstackCurrent as WeatherstackCurrentModel } from '../weatherstack/schema.ts';
import type { Context } from '../context.ts';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Contract for docs/SPEC.md (S1–S7). Edit this file first; server and client types are generated from it. */
  DateTime: { input: Date; output: Date | string; }
};

export type CreatePropertyInput = {
  /** Trimmed, 1–100 chars. */
  city: Scalars['String']['input'];
  state: UsState;
  /** Trimmed, 1–200 chars. */
  street: Scalars['String']['input'];
  /** Exactly 5 digits. */
  zipCode: Scalars['String']['input'];
};

export type CreatePropertyResult = CreatePropertySuccess | DuplicatePropertyError | InvalidInputError | WeatherUnavailableError;

export type CreatePropertySuccess = {
  __typename?: 'CreatePropertySuccess';
  property: Property;
};

export type DeletePropertyResult = DeletePropertySuccess | PropertyNotFoundError;

export type DeletePropertySuccess = {
  __typename?: 'DeletePropertySuccess';
  id: Scalars['ID']['output'];
};

/** S5.4 — same street, city, state and zipCode after trimming (case-sensitive). */
export type DuplicatePropertyError = {
  __typename?: 'DuplicatePropertyError';
  existingPropertyId: Scalars['ID']['output'];
  message: Scalars['String']['output'];
};

export type FieldError = {
  __typename?: 'FieldError';
  /** Input field name, e.g. `zipCode`. */
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

/** S5.3 — every invalid field is listed. */
export type InvalidInputError = {
  __typename?: 'InvalidInputError';
  fieldErrors: Array<FieldError>;
  message: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** S5. The only operation that calls Weatherstack. */
  createProperty: CreatePropertyResult;
  /** S6. */
  deleteProperty: DeletePropertyResult;
};


export type MutationCreatePropertyArgs = {
  input: CreatePropertyInput;
};


export type MutationDeletePropertyArgs = {
  id: Scalars['ID']['input'];
};

/** S7 — a US property, enriched with Weatherstack data when it was created. */
export type Property = {
  __typename?: 'Property';
  city: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lat: Scalars['Float']['output'];
  long: Scalars['Float']['output'];
  state: UsState;
  /** Street and number, e.g. `15528 E Golden Eagle Blvd`. */
  street: Scalars['String']['output'];
  /** Weatherstack `current` at creation time (units=f). Never refreshed. */
  weatherData: Weather;
  /** Exactly 5 digits, e.g. `85268`. */
  zipCode: Scalars['String']['output'];
};

/** S3 — all fields optional; provided fields are AND-ed. Omitted, null or blank = no constraint. */
export type PropertyFilter = {
  /** Case-insensitive substring; `%` and `_` match literally (S3.2–S3.4). */
  city?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<UsState>;
  /** Exact match. Blank = any (S3.4); otherwise exactly 5 digits or BAD_USER_INPUT (S3.5, S3.6). */
  zipCode?: InputMaybe<Scalars['String']['input']>;
};

/** S6.2 — unknown or malformed id. */
export type PropertyNotFoundError = {
  __typename?: 'PropertyNotFoundError';
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
};

/** S2 — ties on createdAt are broken by id in the same direction (S2.3). */
export type PropertyOrderBy = {
  createdAt?: InputMaybe<SortDirection>;
};

export type Query = {
  __typename?: 'Query';
  /** S1–S3. Defaults to newest first. */
  properties: Array<Property>;
  /** S4. Unknown or malformed id returns null. */
  property?: Maybe<Property>;
};


export type QueryPropertiesArgs = {
  filter?: InputMaybe<PropertyFilter>;
  orderBy?: InputMaybe<PropertyOrderBy>;
};


export type QueryPropertyArgs = {
  id: Scalars['ID']['input'];
};

export type SortDirection =
  | 'ASC'
  | 'DESC';

/** US states, DC and inhabited territories (SPEC Decisions: Allowed states). */
export type UsState =
  | 'AK'
  | 'AL'
  | 'AR'
  | 'AS'
  | 'AZ'
  | 'CA'
  | 'CO'
  | 'CT'
  | 'DC'
  | 'DE'
  | 'FL'
  | 'GA'
  | 'GU'
  | 'HI'
  | 'IA'
  | 'ID'
  | 'IL'
  | 'IN'
  | 'KS'
  | 'KY'
  | 'LA'
  | 'MA'
  | 'MD'
  | 'ME'
  | 'MI'
  | 'MN'
  | 'MO'
  | 'MP'
  | 'MS'
  | 'MT'
  | 'NC'
  | 'ND'
  | 'NE'
  | 'NH'
  | 'NJ'
  | 'NM'
  | 'NV'
  | 'NY'
  | 'OH'
  | 'OK'
  | 'OR'
  | 'PA'
  | 'PR'
  | 'RI'
  | 'SC'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'VA'
  | 'VI'
  | 'VT'
  | 'WA'
  | 'WI'
  | 'WV'
  | 'WY';

/**
 * Weatherstack `current` object (Fahrenheit, mph, inches). Fields S4.4 shows are non-null; the rest
 * are nullable so an absent optional field does not block creation.
 */
export type Weather = {
  __typename?: 'Weather';
  cloudcover?: Maybe<Scalars['Int']['output']>;
  feelsLike: Scalars['Float']['output'];
  humidity: Scalars['Int']['output'];
  isDay?: Maybe<Scalars['Boolean']['output']>;
  /** Observation time in UTC as reported by Weatherstack, e.g. `10:35 AM`. */
  observationTime: Scalars['String']['output'];
  precip?: Maybe<Scalars['Float']['output']>;
  pressure?: Maybe<Scalars['Float']['output']>;
  temperature: Scalars['Float']['output'];
  uvIndex?: Maybe<Scalars['Float']['output']>;
  visibility?: Maybe<Scalars['Float']['output']>;
  weatherCode?: Maybe<Scalars['Int']['output']>;
  weatherDescriptions: Array<Scalars['String']['output']>;
  weatherIcons: Array<Scalars['String']['output']>;
  windDegree?: Maybe<Scalars['Int']['output']>;
  windDir: Scalars['String']['output'];
  windSpeed: Scalars['Float']['output'];
};

export type WeatherFailureReason =
  /** Non-2xx status. */
  | 'HTTP_ERROR'
  /** Body failed schema validation, incl. unparsable or out-of-range lat/lon. */
  | 'INVALID_RESPONSE'
  /** Resolved country is not the USA (S5.6). */
  | 'LOCATION_MISMATCH'
  /** Connection refused, DNS failure, reset. */
  | 'NETWORK'
  /** No response within 5 s. */
  | 'TIMEOUT'
  /** HTTP 200 with `{ success: false, error }`. */
  | 'UPSTREAM_ERROR';

/** S5.5 — nothing was persisted. */
export type WeatherUnavailableError = {
  __typename?: 'WeatherUnavailableError';
  message: Scalars['String']['output'];
  reason: WeatherFailureReason;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = {
  CreatePropertyResult:
    | ( Omit<CreatePropertySuccess, 'property'> & { property: _RefType['Property'] } & { __typename: 'CreatePropertySuccess' } )
    | ( DuplicatePropertyError & { __typename: 'DuplicatePropertyError' } )
    | ( InvalidInputError & { __typename: 'InvalidInputError' } )
    | ( WeatherUnavailableError & { __typename: 'WeatherUnavailableError' } )
  ;
  DeletePropertyResult:
    | ( DeletePropertySuccess & { __typename: 'DeletePropertySuccess' } )
    | ( PropertyNotFoundError & { __typename: 'PropertyNotFoundError' } )
  ;
};


/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CreatePropertyInput: CreatePropertyInput;
  CreatePropertyResult: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['CreatePropertyResult']>;
  CreatePropertySuccess: ResolverTypeWrapper<Omit<CreatePropertySuccess, 'property'> & { property: ResolversTypes['Property'] }>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DeletePropertyResult: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['DeletePropertyResult']>;
  DeletePropertySuccess: ResolverTypeWrapper<DeletePropertySuccess>;
  DuplicatePropertyError: ResolverTypeWrapper<DuplicatePropertyError>;
  FieldError: ResolverTypeWrapper<FieldError>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  InvalidInputError: ResolverTypeWrapper<InvalidInputError>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Property: ResolverTypeWrapper<PropertyModel>;
  PropertyFilter: PropertyFilter;
  PropertyNotFoundError: ResolverTypeWrapper<PropertyNotFoundError>;
  PropertyOrderBy: PropertyOrderBy;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SortDirection: SortDirection;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  USState: UsState;
  Weather: ResolverTypeWrapper<WeatherstackCurrentModel>;
  WeatherFailureReason: WeatherFailureReason;
  WeatherUnavailableError: ResolverTypeWrapper<WeatherUnavailableError>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean']['output'];
  CreatePropertyInput: CreatePropertyInput;
  CreatePropertyResult: ResolversUnionTypes<ResolversParentTypes>['CreatePropertyResult'];
  CreatePropertySuccess: Omit<CreatePropertySuccess, 'property'> & { property: ResolversParentTypes['Property'] };
  DateTime: Scalars['DateTime']['output'];
  DeletePropertyResult: ResolversUnionTypes<ResolversParentTypes>['DeletePropertyResult'];
  DeletePropertySuccess: DeletePropertySuccess;
  DuplicatePropertyError: DuplicatePropertyError;
  FieldError: FieldError;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  InvalidInputError: InvalidInputError;
  Mutation: Record<PropertyKey, never>;
  Property: PropertyModel;
  PropertyFilter: PropertyFilter;
  PropertyNotFoundError: PropertyNotFoundError;
  PropertyOrderBy: PropertyOrderBy;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  Weather: WeatherstackCurrentModel;
  WeatherUnavailableError: WeatherUnavailableError;
};

export type CreatePropertyResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CreatePropertyResult'] = ResolversParentTypes['CreatePropertyResult']> = {
  __resolveType: TypeResolveFn<'CreatePropertySuccess' | 'DuplicatePropertyError' | 'InvalidInputError' | 'WeatherUnavailableError', ParentType, ContextType>;
};

export type CreatePropertySuccessResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CreatePropertySuccess'] = ResolversParentTypes['CreatePropertySuccess']> = {
  property?: Resolver<ResolversTypes['Property'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DeletePropertyResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DeletePropertyResult'] = ResolversParentTypes['DeletePropertyResult']> = {
  __resolveType: TypeResolveFn<'DeletePropertySuccess' | 'PropertyNotFoundError', ParentType, ContextType>;
};

export type DeletePropertySuccessResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DeletePropertySuccess'] = ResolversParentTypes['DeletePropertySuccess']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DuplicatePropertyErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DuplicatePropertyError'] = ResolversParentTypes['DuplicatePropertyError']> = {
  existingPropertyId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FieldErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['FieldError'] = ResolversParentTypes['FieldError']> = {
  field?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type InvalidInputErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['InvalidInputError'] = ResolversParentTypes['InvalidInputError']> = {
  fieldErrors?: Resolver<Array<ResolversTypes['FieldError']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  createProperty?: Resolver<ResolversTypes['CreatePropertyResult'], ParentType, ContextType, RequireFields<MutationCreatePropertyArgs, 'input'>>;
  deleteProperty?: Resolver<ResolversTypes['DeletePropertyResult'], ParentType, ContextType, RequireFields<MutationDeletePropertyArgs, 'id'>>;
};

export type PropertyResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Property'] = ResolversParentTypes['Property']> = {
  city?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lat?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  long?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['USState'], ParentType, ContextType>;
  street?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  weatherData?: Resolver<ResolversTypes['Weather'], ParentType, ContextType>;
  zipCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PropertyNotFoundErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PropertyNotFoundError'] = ResolversParentTypes['PropertyNotFoundError']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  properties?: Resolver<Array<ResolversTypes['Property']>, ParentType, ContextType, Partial<QueryPropertiesArgs>>;
  property?: Resolver<Maybe<ResolversTypes['Property']>, ParentType, ContextType, RequireFields<QueryPropertyArgs, 'id'>>;
};

export type WeatherResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Weather'] = ResolversParentTypes['Weather']> = {
  cloudcover?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  feelsLike?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  humidity?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isDay?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  observationTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  precip?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  pressure?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  temperature?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  uvIndex?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  visibility?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  weatherCode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  weatherDescriptions?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  weatherIcons?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  windDegree?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  windDir?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  windSpeed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type WeatherUnavailableErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WeatherUnavailableError'] = ResolversParentTypes['WeatherUnavailableError']> = {
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['WeatherFailureReason'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  CreatePropertyResult?: CreatePropertyResultResolvers<ContextType>;
  CreatePropertySuccess?: CreatePropertySuccessResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DeletePropertyResult?: DeletePropertyResultResolvers<ContextType>;
  DeletePropertySuccess?: DeletePropertySuccessResolvers<ContextType>;
  DuplicatePropertyError?: DuplicatePropertyErrorResolvers<ContextType>;
  FieldError?: FieldErrorResolvers<ContextType>;
  InvalidInputError?: InvalidInputErrorResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Property?: PropertyResolvers<ContextType>;
  PropertyNotFoundError?: PropertyNotFoundErrorResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Weather?: WeatherResolvers<ContextType>;
  WeatherUnavailableError?: WeatherUnavailableErrorResolvers<ContextType>;
};

