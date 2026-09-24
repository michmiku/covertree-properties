import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/schema.graphql',
  generates: {
    'src/__generated__/resolvers-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        // String unions are structurally identical to Prisma's USState, so no enum mapping is needed.
        enumsAsTypes: true,
        contextType: '../context.ts#Context',
        mapperTypeSuffix: 'Model',
        mappers: {
          Property: './prisma/client.ts#Property',
        },
        scalars: {
          DateTime: { input: 'Date', output: 'Date | string' },
        },
        resolversNonOptionalTypename: { unionMember: true },
      },
    },
  },
};

export default config;
