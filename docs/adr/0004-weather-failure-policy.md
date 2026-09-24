# ADR-0004: Weather failure policy: fail creation with a typed error

**Status:** Accepted
**Date:** 2026-09-24
**Deciders:** repo owner (reviewed with Claude Code, see `ai/sessions/`)

## Context

`createProperty` must call Weatherstack `/current` (the brief allows it only there) to get
`weatherData`, `lat` and `long`. Weatherstack can fail in many ways: network, timeout, non-2xx,
**HTTP 200 with `{ success: false }`** (bad key, quota, unknown location), a malformed body, or a
resolved location outside the US. `lat`/`long` exist only in that response. The product owner's
requirement: without Weatherstack data, creation **fails with an explicit error**.

## Decision

Weatherstack failure **aborts the mutation**. It makes one request (5 s timeout, no retries) and
persists nothing. It returns `WeatherUnavailableError { message, reason }` as a member of the
`CreatePropertyResult` union, where `reason` is a `WeatherFailureReason` enum: `NETWORK`,
`TIMEOUT`, `HTTP_ERROR`, `UPSTREAM_ERROR`, `INVALID_RESPONSE`, `LOCATION_MISMATCH` (SPEC
S5.5–S5.6). Validation and the duplicate check run before the call, so bad input never spends quota.

## Options considered

| Option                                           | Data integrity                            | Client handling                         | Complexity           |
| ------------------------------------------------ | ----------------------------------------- | --------------------------------------- | -------------------- |
| **A. Fail, typed union error (chosen)**          | Every row complete (all columns non-null) | Typed `switch` on `__typename`/`reason` | Low                  |
| B. Fail, `errors[]` + `extensions.code`          | Same                                      | Untyped; string-matching codes          | Lowest               |
| C. Persist without weather, mark `weatherStatus` | Partial rows; lat/long null               | Every reader handles "no weather"       | Med                  |
| D. Persist, then enrich async with retries       | Eventually complete                       | Pending states in UI                    | High (queue, worker) |

**A** keeps S7.2 (all fields non-null) true in the database itself, and codegen gives the web
form a typed error to render. **B** would behave the same, but the schema wouldn't document the
failure, and clients would parse `extensions`. **C** contradicts the requirement and forces
nullable `lat`/`long` everywhere. **D** also contradicts it, and would call Weatherstack outside
the mutation, which the brief forbids.

## Trade-off analysis

Rejecting a create when a third party is down reduces availability: a Weatherstack outage blocks
all creation. We accept that because a property without weather and coordinates is defined as
invalid. A failed create wrote nothing, and the form keeps its values (S5.8), so the user can simply
retry later. Automatic retries were rejected. The free tier is ~100 calls/month, and blind retries
on `success: false` (such as an invalid key or exhausted quota) cannot succeed anyway.

## Consequences

- **Easier:** no partial-data states anywhere; the reviewer can test each `reason` offline with MSW (X2).
- **Harder:** the schema carries union result types, so resolvers map service results to union
  members, and the client must handle every branch.
- **Revisit:** if creation availability matters more than completeness, reconsider D, which
  needs a change to the brief's "only during the mutation" rule.

## Action items

1. [x] SDL: `CreatePropertyResult`, `WeatherUnavailableError`, `WeatherFailureReason`.
2. [ ] S5 slice: Weatherstack client with `AbortSignal.timeout(5000)` and a Zod-parsed response;
       one MSW test per `reason`, each asserting no row was written.
3. [ ] Verify the territory `location.country` strings with the real key (SPEC open questions).
