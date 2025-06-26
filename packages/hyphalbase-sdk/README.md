# @hyphalbase/sdk

A typed client for Hyphalbase.

[//]: # '## NOT IMPLEMENTED'
[//]: # '```bash'
[//]: # 'pnpm add @hyphalbase/sdk'
[//]: # '```'
[//]: #
[//]: # '## Usage'
[//]: #
[//]: # '```typescript'
[//]: # "import { HyphalbaseClient } from '@hyphalbase/graphql-client';"
[//]: #
[//]: # '// Create a client'
[//]: # "const client = new HyphalbaseClient('https://your-hyphalbase-endpoint.com/graphql');"
[//]: #
[//]: # '// Get a vector'
[//]: # "const vector = await client.getVector('vector-id');"
[//]: #
[//]: # '// Search vectors'
[//]: # 'const results = await client.searchVectors([0.1, 0.2, 0.3], 10);'
[//]: #
[//]: # '// Put a vector'
[//]: # 'const response = await client.putVector({'
[//]: # "  namespace: 'my-namespace',"
[//]: # "  content: 'Vector content',"
[//]: # '  vector: [0.1, 0.2, 0.3]'
[//]: # '});'
[//]: #
[//]: # '// Delete a vector'
[//]: # "await client.deleteVector('vector-id');"
[//]: # '```'
[//]: #
[//]: # 'See [example.ts](./src/example.ts) for a complete example of how to use the client.'
[//]: #
[//]: # '## Development'
[//]: #
[//]: # '### Generate Types'
[//]: #
[//]: # 'To generate TypeScript types from the GraphQL schema:'
[//]: #
[//]: # '```bash'
[//]: # 'pnpm run generate'
[//]: # '```'
[//]: #
[//]: # '### Build'
[//]: #
[//]: # 'To build the package:'
[//]: #
[//]: # '```bash'
[//]: # 'pnpm run build'
[//]: # '```'
[//]: #
[//]: # '### Run Example'
[//]: #
[//]: # 'To run the example code:'
[//]: #
[//]: # '```bash'
[//]: # 'pnpm run example'
[//]: # '```'
[//]: #
[//]: # 'This will execute the example in `src/example.ts` which demonstrates how to use the client.'
