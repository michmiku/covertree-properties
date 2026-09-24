# SPEC — Covertree property records

Source: Covertree "AI Software Engineer" assessment brief plus product decisions recorded
below. This spec is the contract the `reviewer` agent checks against; story IDs (`S1`…`S7`)
and criterion IDs (`S3.2`) are stable — reference them in commits, tests and reviews.

## Problem statement

Covertree needs to manage records of US residential properties through a GraphQL API with a
React UI. Each property must be enriched with the current weather and coordinates of its
location at the moment it is created, so records carry location data the user never has to
enter by hand. A property without that data is incomplete, so it must never be stored.

## Goals

1. Every user story S1–S7 is implemented end to end (API + UI) and covered by automated tests
   named after the criteria below.
2. Weatherstack is called **only** inside the `createProperty` mutation — never on reads,
   deletes, or in tests.
3. No property is ever persisted without Weatherstack weather, `lat` and `long`; every failure
   mode reaches the client as a **typed** error in the schema.
4. The GraphQL schema is the single contract: server resolvers and client documents are typed
   from it by codegen, with zero hand-written duplicate types.
5. A reviewer can run the whole app from the README in ≤ 3 commands (plus `.env`).

## Non-goals

- **Authentication / multi-tenancy** — not in the brief; every user sees all properties.
- **Updating a property** — the brief lists create/read/delete only; weather is a creation
  snapshot, so edits would make it misleading.
- **Refreshing weather after creation** — the brief forbids calling Weatherstack outside creation.
- **Address autocomplete / geocoding services** — lat/long come from the Weatherstack response.
- **Pagination** — P2; the dataset in scope is small. The list API takes input objects so it
  can be added without breaking the contract.
- **Non-US addresses** — the brief assumes all properties are in the United States.

## Decisions

| Topic                  | Decision                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default sort           | `createdAt DESC` (newest first); ties broken by `id` in the same direction so order is stable.                                                                        |
| Filter semantics       | All filter fields optional; omitted, `null` or blank-after-trim = no constraint; provided fields are AND-ed.                                                          |
| City filter            | **Contains**, case-insensitive, after trimming; `%` and `_` are literal characters, not wildcards.                                                                    |
| Zip filter             | **Exact** match; blank = any, otherwise exactly 5 digits or the query is rejected.                                                                                    |
| State filter           | Single `USState` enum value, exact match.                                                                                                                             |
| Allowed states         | `enum USState`: 50 states + `DC` + territories `PR`, `GU`, `VI`, `AS`, `MP` (56 values).                                                                              |
| Zip validation         | `^\d{5}$` (ZIP+4 and other formats rejected).                                                                                                                         |
| Weatherstack query     | `query="<zipCode>, <state>, USA"`, `units=f`; one request, 5 s timeout, **no retries**.                                                                               |
| Units                  | Fahrenheit / mph / inches (`units=f`), stored as returned.                                                                                                            |
| Weatherstack failure   | Creation fails; nothing persisted; mutation returns `WeatherUnavailableError` with a `reason` (S5.5).                                                                 |
| Location check         | Resolved `location.country` must be a US country string (S5.6); otherwise `LOCATION_MISMATCH`.                                                                        |
| Mutation error style   | Errors-as-data: mutations return result unions; expected failures never go to `errors[]`.                                                                             |
| Query error style      | Invalid query arguments (e.g. filter zip `85A68`) → GraphQL error, `extensions.code = BAD_USER_INPUT`.                                                                |
| Duplicates             | Rejected. Duplicate = same `street`, `city`, `state`, `zipCode` after **trimming only** (case-sensitive). Checked before Weatherstack; DB unique constraint backs it. |
| Unknown / malformed id | Treated the same: `property` → `null`; `deleteProperty` → `PropertyNotFoundError`.                                                                                    |

## User stories

| ID  | Story                                                                                            |
| --- | ------------------------------------------------------------------------------------------------ |
| S1  | As a user, I can query all properties so that I can see every record.                            |
| S2  | As a user, I can sort properties by creation date so that I can find the newest or oldest.       |
| S3  | As a user, I can filter the list by city, zip code and state so that I can narrow to a location. |
| S4  | As a user, I can view the details of any property so that I can see its weather and coordinates. |
| S5  | As a user, I can add a new US property so that it is recorded with its current weather.          |
| S6  | As a user, I can delete any property so that obsolete records are removed.                       |
| S7  | Property shape (data contract for S1–S6).                                                        |

## Requirements (P0) and acceptance criteria

### S7 — Property data contract

| Field         | Source         | Rule                                                                                      |
| ------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `id`          | DB-generated   | UUID; never accepted as input                                                             |
| `street`      | mutation input | street + number, e.g. `15528 E Golden Eagle Blvd`; trimmed, 1–200 chars                   |
| `city`        | mutation input | e.g. `Fountain Hills`; trimmed, 1–100 chars                                               |
| `state`       | mutation input | `enum USState` (see Decisions), e.g. `AZ`                                                 |
| `zipCode`     | mutation input | exactly 5 digits (`^\d{5}$`), e.g. `85268`; kept as a string (leading zeros matter)       |
| `weatherData` | Weatherstack   | the `current` object of the response, stored as JSON, exposed as a typed `Weather` object |
| `lat`         | Weatherstack   | `location.lat` parsed from string to Float, e.g. `33.609`                                 |
| `long`        | Weatherstack   | `location.lon` parsed from string to Float, e.g. `-111.729`                               |
| `createdAt`   | DB-generated   | timestamp, exposed as ISO-8601 `DateTime`                                                 |

- **S7.1** `id`, `createdAt`, `weatherData`, `lat`, `long` cannot be supplied by the client
  (they are not fields of `CreatePropertyInput`).
- **S7.2** All fields are non-null on a persisted property.
- **S7.3** `lat` is within [-90, 90] and `long` within [-180, 180]; values outside fail S5.5 as
  `INVALID_RESPONSE`.

### S1 — List properties

- **S1.1** `properties` query returns all persisted properties with every S7 field selectable.
- **S1.2** Empty database returns `[]` (not `null`, not an error); UI shows an empty state.
- **S1.3** No Weatherstack request is made while listing.

### S2 — Sort by creation date

- **S2.1** `properties(orderBy: { createdAt: SortDirection })` with `enum SortDirection { ASC DESC }`;
  when `orderBy` is omitted the order is `DESC` (newest first).
- **S2.2** Given properties created in order A, B, C: `ASC` returns A, B, C; `DESC` and the
  default return C, B, A.
- **S2.3** Properties with identical `createdAt` are ordered by `id` in the same direction, so
  repeated queries return the same order.
- **S2.4** UI shows the current direction (default "Newest first") and a toggle that re-queries
  with the other direction.

### S3 — Filter by city, zip code, state

- **S3.1** `properties(filter: { city, zipCode, state })`; every field optional; provided fields
  are AND-ed (`city: "Hills", state: AZ` returns only AZ properties whose city contains "hills").
- **S3.2** `city` matches as a case-insensitive **substring** after trimming: `fountain`,
  `HILLS` and `Fountain Hills` all match `Fountain Hills`.
- **S3.3** `%` and `_` in the city filter are matched literally (`Fo%` does not match `Fountain Hills`).
- **S3.4** A `city` or `zipCode` filter that is empty or whitespace-only applies no constraint.
- **S3.5** `zipCode` matches exactly: `85268` matches only `85268`, `8526` is not a prefix match.
- **S3.6** A non-blank `zipCode` that is not exactly 5 digits after trimming (`85A68`, `8526`,
  `852681`) is rejected with a GraphQL error `BAD_USER_INPUT`, not an empty list.
- **S3.7** `state` matches the enum value exactly; a value outside `USState` is rejected by
  GraphQL validation.
- **S3.8** Filter and sort combine: S2 ordering applies to the filtered set.
- **S3.9** No filter (or all fields omitted) returns the same result as S1.
- **S3.10** A filter matching nothing returns `[]`; UI shows "no matches" with a way to clear filters.

### S4 — Property details

- **S4.1** `property(id: ID!)` returns the property with all S7 fields including weather.
- **S4.2** An unknown id **or** a malformed (non-UUID) id returns `null`, not an error; UI shows
  "not found".
- **S4.3** No Weatherstack request is made when reading details.
- **S4.4** UI detail view shows address, coordinates and the key weather fields
  (temperature °F, description + icon, feels-like °F, humidity, wind mph, observation time
  labelled UTC; Weatherstack's `observation_time` is UTC). Descriptions are shown trimmed.

### S5 — Create property

Schema shape (names are binding, fields may grow):

```graphql
union CreatePropertyResult =
  | CreatePropertySuccess
  | InvalidInputError
  | DuplicatePropertyError
  | WeatherUnavailableError

type CreatePropertySuccess {
  property: Property!
}
type InvalidInputError {
  message: String!
  fieldErrors: [FieldError!]!
}
type FieldError {
  field: String!
  message: String!
}
type DuplicatePropertyError {
  message: String!
  existingPropertyId: ID!
}
type WeatherUnavailableError {
  message: String!
  reason: WeatherFailureReason!
}

enum WeatherFailureReason {
  NETWORK # connection refused, DNS, reset
  TIMEOUT # no response within 5 s
  HTTP_ERROR # non-2xx status
  UPSTREAM_ERROR # HTTP 200 with { success: false, error }
  INVALID_RESPONSE # body fails schema validation (incl. unparsable / out-of-range lat/lon)
  LOCATION_MISMATCH # resolved country is not the USA (S5.6)
}
```

Processing order: validate → duplicate check → Weatherstack → persist.

- **S5.1** `createProperty(input: { street, city, state, zipCode })` on success performs
  **exactly one** Weatherstack `/current` request, persists the property, and returns
  `CreatePropertySuccess` with weather, `lat`, `long`.
- **S5.2** The request sends `query="<zipCode>, <state>, USA"` (e.g. `85268, AZ, USA`),
  `units=f`, and the access key; the key never appears in responses or logs.
- **S5.3** Validation (S7 rules)
  - `zipCode` not matching `^\d{5}$` (`8526`, `85268-1234`, `8526A`) → `InvalidInputError`
    with a `fieldErrors` entry for `zipCode`.
  - `street` / `city` empty after trimming or over length → `InvalidInputError` with the field named.
  - `state` outside `USState` (e.g. `XX`, `az` as a string) is rejected by GraphQL validation
    before the resolver runs.
  - All invalid fields are reported together, not only the first.
  - Invalid input makes **no** Weatherstack request and persists nothing.
- **S5.4** Duplicates
  - Given a property with `street`, `city`, `state`, `zipCode` already exists (compared after
    trimming, case-sensitive), creating it again returns `DuplicatePropertyError` with
    `existingPropertyId`, makes **no** Weatherstack request, and persists nothing.
  - Differing only in case (`main st` vs `Main St`) is **not** a duplicate.
  - Two concurrent identical creates yield one `CreatePropertySuccess` and one
    `DuplicatePropertyError` (DB unique constraint), never two rows.
- **S5.5** Weatherstack failure — creation **fails**, nothing is persisted, and the mutation
  returns `WeatherUnavailableError` (in `data`, not `errors[]`) with:
  - `NETWORK` when the request cannot connect;
  - `TIMEOUT` when no response arrives within 5 s;
  - `HTTP_ERROR` on any non-2xx status;
  - `UPSTREAM_ERROR` on HTTP 200 with `{ success: false, error }` (e.g. invalid key, quota,
    location not found);
  - `INVALID_RESPONSE` when the body fails Zod validation — missing `current` or `location`,
    `lat`/`lon` not parseable as numbers, or out of range (S7.3);
  - `LOCATION_MISMATCH` per S5.6.
  - `message` is human-readable and does not contain the access key or raw upstream body.
  - No retry is made; exactly one request per create attempt.
- **S5.6** Location check: for every `USState` value (territories included), `location.country`
  must be `USA United States of America` or `United States of America`. Any other country →
  `WeatherUnavailableError { reason: LOCATION_MISMATCH }`, nothing persisted. `region` is not
  compared. (Verified 2026-09-24: `85268, AZ, USA` and `00901, PR, USA` both return
  `USA United States of America`; PR appears only in `region`.)

- **S5.7** Weatherstack base URL and access key come from env (`WEATHERSTACK_BASE_URL`,
  `WEATHERSTACK_ACCESS_KEY`).
- **S5.8** UI form validates the same rules as S5.3 before submitting, disables submit while
  pending, and handles every union member: success → navigates to the new property and the list
  includes it; `InvalidInputError` → message next to each field; `DuplicatePropertyError` →
  message with a link to the existing property; `WeatherUnavailableError` → explicit
  "Weather data unavailable, property not created" message and the form keeps its values.

### S6 — Delete property

```graphql
union DeletePropertyResult = DeletePropertySuccess | PropertyNotFoundError
type DeletePropertySuccess {
  id: ID!
}
type PropertyNotFoundError {
  message: String!
  id: ID!
}
```

- **S6.1** `deleteProperty(id: ID!)` removes the property and returns `DeletePropertySuccess { id }`.
- **S6.2** Deleting an unknown or malformed id returns `PropertyNotFoundError` (in `data`); no
  rows change.
- **S6.3** Deleting the same id twice: first → `DeletePropertySuccess`, second → `PropertyNotFoundError`.
- **S6.4** After a delete, the same address can be created again (no longer a duplicate).
- **S6.5** No Weatherstack request is made while deleting.
- **S6.6** UI asks for confirmation; after delete the property is gone from the list and its
  detail route shows "not found".

### Cross-cutting (X)

- **X1** Layering: resolver → service → repository. The Weatherstack client is built once
  (`src/container.ts`) and injected into the create-property service only; the GraphQL context
  carries services, never the client, so resolvers can't reach it (lint-enforced). Services
  return domain results; resolvers map them to the union types.
- **X2** Tests never reach the real Weatherstack (MSW `onUnhandledRequest: 'error'`, fake key).
  Every `WeatherFailureReason` has at least one test.
- **X3** README: prerequisites, `.env` setup, run, test, e2e.
- **X4** One Playwright happy path: create → appears in list → filter → detail → delete. One
  Playwright failure path: stub returns `success: false` → UI shows the weather error and the
  list is unchanged.

## Nice-to-have (P1)

- Filter/sort state persisted in the URL query string (shareable, survives reload).
- Loading skeletons and a toast on create/delete.

## Future considerations (P2)

- Cursor pagination (`properties(first, after)`); list query already takes input objects.
- Weather refresh as an explicit, separate mutation (would require revisiting the brief's rule).
- Multi-value state filter (`state: [USState!]`).

## Success metrics (assessment context)

- **Scope:** reviewer agent reports PASS for every P0 criterion above.
- **Quality gate:** `pnpm verify` (format, lint, typecheck, tests, build, e2e) green locally and in CI.
- **Isolation:** 0 real Weatherstack calls during `pnpm verify` (enforced, not just observed).
- **Integrity:** 0 persisted rows with missing weather/lat/long (enforced by non-null columns).

## Resolved questions (verified 2026-09-24 with the real key, `weatherstack:probe`)

- `"<zip>, <state>, USA"` resolves for a state (`85268, AZ, USA` → Fountain Hills) and a
  territory (`00901, PR, USA` → San Juan). Weatherstack treats it as a place query
  (`request.type: "City"`), not a postal-code lookup.
- `location.country` is `USA United States of America` for both; territories are named only in
  `region` → S5.6 simplified to one US list.
- `http://api.weatherstack.com` works on the free tier (default `WEATHERSTACK_BASE_URL`).
- `current.observation_time` is UTC; `weather_descriptions` may carry trailing spaces; the body
  also includes `astro` and `air_quality`, which are stored but not exposed.
- Not verified: GU, VI, AS, MP (assumed to behave like PR).
