import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
	schema: '../../packages/hyphalbase/schema.graphql',
	documents: ['./src/operations/**/*.ts'],
	generates: {
		'./dist/generated/': {
			preset: 'client',
			plugins: [
				'typescript',
				'typescript-operations',
				'typescript-graphql-request',
			],
			config: {
				avoidOptionals: true,
				skipTypename: true,
				dedupeFragments: true,
			},
		},
	},
};

export default config;
