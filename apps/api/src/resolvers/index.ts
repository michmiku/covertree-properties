import { DateTimeResolver } from 'graphql-scalars';
import type { Resolvers } from '../__generated__/resolvers-types.ts';

export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,
};
