import { createYoga, createSchema } from 'graphql-yoga';

import AdminSchema from './admin-schema';
import ApiSchema from './api-schema';
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

    const adminApiSchema = createSchema(AdminSchema(this));
    // admin api
    this.adminApi = createYoga({
      schema: adminApiSchema,
      graphqlEndpoint: '/admin',
      graphiql: {
        endpoint: '/admin',
      },
    });

    const apiSchema = createSchema<{ apiKey: string }>(ApiSchema(this));
    // vector api
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

    // Handle SQL endpoint for backward compatibility
    if (path === '/sql') {
      return new Response('Bad Request', { status: 400 });
    }

    if (path === '/' || path.includes('/admin')) {
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
              body?.query.includes('validateApiKey'));

          if (isUserManagementOrApiKeyValidation) {
            return this.adminApi.fetch(request);
          }
        } catch (e) {
          // ignore error and continue
        }
      }
      return this.adminApi.fetch(request);
    }
    if (path === '/graphql') {
      // Route to the API schema
      return this.api.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
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
