import { HyphalObject } from './hyphal_object';
import { createYoga, createSchema } from 'graphql-yoga';
import Schema from './gql-schema';
export class SQLiteDurableObject implements DurableObject {
	hyphal_object: HyphalObject;
	yoga: any;

	constructor(readonly ctx: DurableObjectState) {
		this.hyphal_object = new HyphalObject(ctx.storage.sql);

		// Create GraphQL schema based on HyphalObject interface
		const schema = createSchema(Schema(this));

		// Create GraphQL Yoga server
		this.yoga = createYoga({
			schema,
			graphiql: true, // Enable GraphiQL for easy testing
		});
	}

	fetch(request: Request) {
		// Handle GraphQL requests
		return this.yoga.fetch(request);
	}
}

export default <ExportedHandler<Env>>{
	fetch(request, env) {
		const url = new URL(request.url);

		// Handle GraphQL requests at /graphql path
		if (url.pathname === '/graphql') {
			// Use the SQLiteDurableObject for GraphQL requests
			const id = env.SQL.idFromName('graphql');
			const stub = env.SQL.get(id);
			return stub.fetch(request);
		}

		// Legacy endpoint - return 400 for backward compatibility testing
		if (url.pathname === '/sql') {
			return new Response('Bad Request', { status: 400 });
		}

		// Return 404 for unknown paths
		return new Response('Not Found', { status: 404 });
	},
};
