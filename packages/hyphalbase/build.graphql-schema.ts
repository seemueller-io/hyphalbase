import GqlSchema from './src/gql-schema';
import { HyphalObject } from './src/hyphal-object';
import { createSchema } from 'graphql-yoga';
import { printSchema } from 'graphql';
import { writeFileSync } from 'node:fs';

const gqlSchema = GqlSchema({ hyphal_object: new HyphalObject(undefined) });

const schema = createSchema(gqlSchema);

const schemaAsString = printSchema(schema);

writeFileSync('schema.graphql', schemaAsString);
