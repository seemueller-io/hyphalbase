import { createYoga, createSchema } from 'graphql-yoga';

import AdminSchema from './admin-schema';
import Schema from './api-schema';
import { Gateway } from './gateway';
import { HyphalObject } from './hyphal-object';
export class SQLiteDurableObject implements DurableObject {
  gateway: Gateway;
  hyphal_object: HyphalObject;
  api;
  adminApi;

  constructor(readonly ctx: DurableObjectState) {
    this.gateway = new Gateway(ctx.storage.sql);
    this.hyphal_object = new HyphalObject(ctx.storage.sql);

    // Create GraphQL schema based on HyphalObject interface
    const apiSchema = createSchema(Schema(this));
    const adminApiSchema = createSchema(AdminSchema(this));

    // admin api for managing users
    this.adminApi = createYoga({
      schema: adminApiSchema,
      graphqlEndpoint: '/graphql',
      graphiql: {
        endpoint: '/graphql',
      },
    });

    // core api features for vectors
    this.api = createYoga({
      schema: apiSchema,
      context: options => {
        const apiKey = options.request.headers.get('X-API-Key');
        return {
          apiKey,
        };
      },
      graphqlEndpoint: '/graphql',
      graphiql: {
        endpoint: '/graphql',
      },
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    console.log({ path });

    // Handle SQL endpoint for backward compatibility
    if (path === '/sql') {
      return new Response('Bad Request', { status: 400 });
    }

    if (path === '/' || path === '/graphql' || path === '/igraphql') {
      console.log('serve admin');

      // If it's a POST request, check if it's for user management or API key validation
      if (request.method === 'POST') {
        // Clone the request to read its body
        const clonedRequest = request.clone();
        try {
          const body: any = await clonedRequest.json();

          // Check if the request is for user management or API key validation operations
          // These operations don't require an API key
          const isUserManagementOrApiKeyValidation =
            body?.query &&
            (body?.query.includes('createUser') ||
              body?.query.includes('createApiKeyForUser') ||
              body?.query.includes('validateApiKey') ||
              body?.query.includes('getAllUserKeys'));

          if (isUserManagementOrApiKeyValidation) {
            return this.adminApi.fetch(request);
          }

          // Check if the request is for a mutation or query that's in the API schema

          // Route to the API schema
        } catch (e) {
          // If we can't parse the body as JSON, just continue with the admin API
        }
      }
      return this.adminApi.fetch(request);
    }

    return this.api.fetch(request);
  }
}

export default <ExportedHandler<Env>>{
  fetch(request, env) {
    // Handle GraphQL requests at /graphql path
    // Use the SQLiteDurableObject for GraphQL requests
    const id = env.SQL.idFromName('graphql');
    const stub = env.SQL.get(id);
    const result = stub.fetch(request);
    return result;

    // Legacy endpoint - return 400 for backward compatibility testing
  },
};
