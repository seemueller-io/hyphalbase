import { writeFileSync } from 'node:fs';

import { printSchema } from 'graphql';
import { createSchema } from 'graphql-yoga';

import GqlSchema from './src/gql-schema';
import { HyphalObject } from './src/hyphal-object';

const gqlSchema = GqlSchema({ hyphal_object: new HyphalObject(undefined) });

const schema = createSchema(gqlSchema);

const schemaAsString = printSchema(schema);

writeFileSync('schema.graphql', schemaAsString);
