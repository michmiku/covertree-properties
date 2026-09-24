import { describe, expect, it } from 'vitest';
import { readEnv } from './env.ts';

const VALID = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  WEATHERSTACK_BASE_URL: 'http://weatherstack.test',
  WEATHERSTACK_ACCESS_KEY: 'secret-key',
};

describe('readEnv', () => {
  it('S5.7 reads the Weatherstack base URL and access key from env', () => {
    expect(readEnv(VALID)).toMatchObject({
      WEATHERSTACK_BASE_URL: 'http://weatherstack.test',
      WEATHERSTACK_ACCESS_KEY: 'secret-key',
      PORT: 4000,
    });
  });

  it('S5.7 defaults the base URL to the HTTP endpoint the free tier requires', () => {
    const withoutBaseUrl = { ...VALID, WEATHERSTACK_BASE_URL: undefined };

    expect(readEnv(withoutBaseUrl).WEATHERSTACK_BASE_URL).toBe('http://api.weatherstack.com');
  });

  it('S5.7 names missing variables without echoing any values', () => {
    const broken = { ...VALID, DATABASE_URL: 'not a url', WEATHERSTACK_ACCESS_KEY: undefined };

    expect(() => readEnv(broken)).toThrow(/DATABASE_URL, WEATHERSTACK_ACCESS_KEY/);
    expect(() => readEnv(broken)).not.toThrow(/not a url/);
  });
});
