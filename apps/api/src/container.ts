import type { PrismaClient } from './__generated__/prisma/client.ts';
import type { Env } from './env.ts';
import { createPropertyRepository } from './repositories/property.repository.ts';
import { createPropertyService } from './services/create-property.service.ts';
import type { Services } from './services/index.ts';
import { createWeatherstackClient } from './weatherstack/client.ts';

type WeatherstackEnv = Pick<Env, 'WEATHERSTACK_BASE_URL' | 'WEATHERSTACK_ACCESS_KEY'>;

/**
 * Builds the services once (SPEC X1). The Weatherstack client is created here from env (S5.7)
 * and handed only to the create-property service; resolvers see nothing but `services`.
 */
export function createServices(env: WeatherstackEnv, prisma: PrismaClient): Services {
  const properties = createPropertyRepository(prisma);
  const weatherstack = createWeatherstackClient({
    baseUrl: env.WEATHERSTACK_BASE_URL,
    accessKey: env.WEATHERSTACK_ACCESS_KEY,
  });
  return {
    createProperty: createPropertyService({ properties, weatherstack }),
  };
}
