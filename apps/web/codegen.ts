import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../api/src/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        useTypeImports: true,
        // Runtime object for the state <select>, generated from the schema rather than duplicated.
        enumType: 'const',
        namingConvention: 'keep',
        scalars: { DateTime: 'string' },
        // Apollo adds __typename to every selection; types (and test mocks) should match responses.
        nonOptionalTypename: true,
      },
    },
  },
};

export default config;
