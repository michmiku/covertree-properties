import { DateTimeResolver } from 'graphql-scalars';
import type { Resolvers } from '../__generated__/resolvers-types.ts';
import { propertyResolvers } from './property.resolvers.ts';

export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,
  ...propertyResolvers,
};
