import { WeatherstackError, WeatherstackSuccess } from './schema.ts';

/** Why a lookup produced no usable data. Mirrors GraphQL `WeatherFailureReason` (SPEC S5.5). */
export type WeatherFailureReason =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE'
  | 'LOCATION_MISMATCH';

export type WeatherLookup =
  | {
      ok: true;
      response: WeatherstackSuccess;
      /** Body exactly as received (lat/lon still strings); used to record test fixtures. */
      raw: unknown;
    }
  | {
      ok: false;
      reason: Exclude<WeatherFailureReason, 'LOCATION_MISMATCH'>;
      /** For logs only. Never contains the access key; never sent to clients. */
      detail: string;
    };

export interface WeatherstackClient {
  /** Exactly one `/current` request; never throws. */
  current(query: string): Promise<WeatherLookup>;
}

export interface WeatherstackClientOptions {
  baseUrl: string;
  accessKey: string;
  timeoutMs?: number;
}

/** SPEC S5.5: no response within 5 s → TIMEOUT. */
export const WEATHERSTACK_TIMEOUT_MS = 5000;

const isTimeout = (error: unknown) =>
  error instanceof DOMException && error.name === 'TimeoutError';

/** Rejects with the signal's reason once it aborts, so no await can outlive the timeout. */
const rejectOnAbort = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

export function createWeatherstackClient({
  baseUrl,
  accessKey,
  timeoutMs = WEATHERSTACK_TIMEOUT_MS,
}: WeatherstackClientOptions): WeatherstackClient {
  const redact = (text: string) =>
    text
      .replaceAll(accessKey, '[redacted]')
      .replaceAll(encodeURIComponent(accessKey), '[redacted]');
  // Keep any path prefix on the base URL (e.g. a stub mounted under /weatherstack).
  const endpoint = new URL('current', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  return {
    async current(query) {
      const url = new URL(endpoint);
      url.searchParams.set('access_key', accessKey);
      url.searchParams.set('query', query);
      url.searchParams.set('units', 'f');

      const signal = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, { signal });
      } catch (error) {
        return {
          ok: false,
          reason: isTimeout(error) ? 'TIMEOUT' : 'NETWORK',
          detail: redact(error instanceof Error ? error.message : String(error)),
        };
      }

      if (!response.ok) {
        return { ok: false, reason: 'HTTP_ERROR', detail: `HTTP ${response.status}` };
      }

      let body: unknown;
      try {
        body = await Promise.race([response.json(), rejectOnAbort(signal)]);
      } catch (error) {
        // The timeout also covers reading the body.
        if (isTimeout(error))
          return { ok: false, reason: 'TIMEOUT', detail: 'body read timed out' };
        return { ok: false, reason: 'INVALID_RESPONSE', detail: 'body is not JSON' };
      }

      const upstreamError = WeatherstackError.safeParse(body);
      if (upstreamError.success) {
        const { code, type } = upstreamError.data.error ?? {};
        return {
          ok: false,
          reason: 'UPSTREAM_ERROR',
          detail: redact(`success:false code=${code ?? '?'} type=${type ?? '?'}`),
        };
      }

      const parsed = WeatherstackSuccess.safeParse(body);
      if (!parsed.success) {
        const paths = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
        return { ok: false, reason: 'INVALID_RESPONSE', detail: `invalid fields: ${paths}` };
      }
      return { ok: true, response: parsed.data, raw: body };
    },
  };
}
