# SPEC — Covertree property records

Source: Covertree "AI Software Engineer" assessment brief. This spec is the contract the
`reviewer` agent checks against; story IDs (`S1`…`S7`) and criterion IDs (`S3.2`) are stable
— reference them in commits, tests and reviews.

## Problem statement

Covertree needs to manage records of US residential properties through a GraphQL API with a
React UI. Each property must be enriched with the current weather and coordinates of its
location at the moment it is created, so records carry location data the user never has to
enter by hand.

## Goals

1. Every user story S1–S7 is implemented end to end (API + UI) and covered by automated tests.
2. Weatherstack is called **only** inside the `createProperty` mutation — never on reads, never
   in tests.
3. A reviewer can run the whole app from the README in ≤ 3 commands (plus `.env`).
4. The GraphQL schema is the single contract: server resolvers and client documents are typed
   from it by codegen, with zero hand-written duplicate types.

## Non-goals

- **Authentication / multi-tenancy** — not in the brief; every user sees all properties.
- **Updating a property** — the brief lists create/read/delete only; weather is a creation
  snapshot, so edits would make it misleading.
- **Refreshing weather after creation** — the brief forbids calling Weatherstack outside creation.
- **Address autocomplete / geocoding services** — lat/long come from the Weatherstack response.
- **Pagination** — P2; the dataset in scope is small. The list API is shaped so it can be added.
- **Non-US addresses** — the brief assumes all properties are in the United States.

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
| `state`       | mutation input | GraphQL `enum USState` — 50 states + `DC`, e.g. `AZ`                                      |
| `zipCode`     | mutation input | exactly 5 digits (`^\d{5}$`), e.g. `85268`                                                |
| `weatherData` | Weatherstack   | the `current` object of the response, stored as JSON, exposed as a typed `Weather` object |
| `lat`         | Weatherstack   | `location.lat` parsed from string to Float, e.g. `33.609`                                 |
| `long`        | Weatherstack   | `location.lon` parsed from string to Float, e.g. `-111.729`                               |
| `createdAt`   | DB-generated   | timestamp, exposed as ISO-8601 `DateTime`                                                 |

- **S7.1** `id`, `createdAt`, `weatherData`, `lat`, `long` cannot be supplied by the client.
- **S7.2** All fields are non-null on a persisted property.

### S1 — List properties

- **S1.1** `properties` query returns all persisted properties with every S7 field selectable.
- **S1.2** Empty database returns `[]` (not null, not an error); UI shows an empty state.
- **S1.3** No Weatherstack request is made while listing.

### S2 — Sort by creation date

- **S2.1** `properties(orderBy: { createdAt: ASC | DESC })`; default is `DESC` (newest first).
- **S2.2** Given three properties created in order A, B, C, `ASC` returns A,B,C and `DESC` returns C,B,A.
- **S2.3** UI exposes a sort toggle that re-queries with the chosen direction.

### S3 — Filter by city, zip code, state

- **S3.1** `properties(filter: { city, zipCode, state })`; every field optional; provided fields are AND-ed.
- **S3.2** `city` matches exactly but **case-insensitively** (`fountain hills` matches `Fountain Hills`).
- **S3.3** `zipCode` matches exactly; `state` matches the enum value.
- **S3.4** Filter + sort combine (S2 applies to the filtered set).
- **S3.5** A filter matching nothing returns `[]`; UI shows "no matches" with a way to clear filters.
- **S3.6** Invalid filter input (e.g. zip `85A68`) is rejected with a validation error, not an empty list.

### S4 — Property details

- **S4.1** `property(id: ID!)` returns the property with all S7 fields including weather.
- **S4.2** Unknown but well-formed id returns `null`; UI shows "not found". Malformed id → validation error.
- **S4.3** No Weatherstack request is made when reading details.
- **S4.4** UI detail view shows address, coordinates and the key weather fields
  (temperature, description + icon, feels-like, humidity, wind, observation time).

### S5 — Create property

- **S5.1** `createProperty(input: { street, city, state, zipCode })` performs **exactly one**
  Weatherstack `/current` request, then persists and returns the property with weather, lat, long.
- **S5.2** Query sent to Weatherstack is `"<zipCode>, <state>, USA"` (a street address is not resolvable by Weatherstack); `units=m`.
- **S5.3** Input violating S7 rules is rejected **before** any Weatherstack call.
- **S5.4** If Weatherstack fails — network error, timeout (5 s), non-2xx, **or HTTP 200 with
  `{ success: false, error }`**, or a response that fails schema validation — the mutation
  returns a GraphQL error with code `WEATHER_UNAVAILABLE` and **nothing is persisted**.
- **S5.5** Weatherstack base URL and access key come from env (`WEATHERSTACK_BASE_URL`,
  `WEATHERSTACK_ACCESS_KEY`); the key never appears in responses or logs.
- **S5.6** UI form validates the same rules, disables submit while pending, shows the server
  error on failure, and navigates to / shows the new property on success; the list reflects it.

### S6 — Delete property

- **S6.1** `deleteProperty(id: ID!)` removes the property and returns its id.
- **S6.2** Deleting an unknown id returns a `NOT_FOUND` GraphQL error.
- **S6.3** No Weatherstack request is made while deleting.
- **S6.4** UI asks for confirmation; after delete the property is gone from the list and its
  detail route shows "not found".

### Cross-cutting (X)

- **X1** Layering: resolver → service → repository. The Weatherstack client is injected through the
  GraphQL context and used only by the create-property service (lint-enforced).
- **X2** Tests never reach the real Weatherstack (MSW `onUnhandledRequest: 'error'`, fake key).
- **X3** README: prerequisites, `.env` setup, run, test, e2e.
- **X4** One Playwright happy path: create → appears in list → filter → detail → delete.

## Nice-to-have (P1)

- Filter/sort state persisted in the URL query string (shareable, survives reload).
- Loading skeletons and a toast on create/delete.

## Future considerations (P2)

- Cursor pagination (`properties(first, after)`); list query already takes an input object.
- Weather refresh as an explicit, separate mutation (would require revisiting the brief's rule).

## Success metrics (assessment context)

- **Scope:** reviewer agent reports PASS for every P0 criterion above.
- **Quality gate:** `pnpm verify` (lint, typecheck, tests, build, e2e) green locally and in CI.
- **Isolation:** 0 real Weatherstack calls during `pnpm verify` (enforced, not just observed).

## Decisions previously open (resolved)

- Weatherstack free tier is HTTP-only → base URL is configurable; default `http://api.weatherstack.com`.
  Verify with the real key on first run.
- `lat`/`lon` arrive as strings → parsed with Zod coercion; unparsable → S5.4.
- Weather failure blocks creation (lat/long are mandatory and only come from Weatherstack).

## Open questions (non-blocking)

- Does Weatherstack resolve `"<zip>, <state>, USA"` reliably for all US zips? _(engineering — check
  on first real call; fallback is `"<city>, <state>, USA"`.)_
