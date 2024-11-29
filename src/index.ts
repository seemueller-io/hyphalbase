import {HyphalObject} from "./hyphal_object";

export {HyphalObject};

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.toml
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname === "/404") {
			return new Response("Not found", { status: 404 });
		}
		// We will create a `DurableObjectId` using the pathname from the Worker request
		// This id refers to a unique instance of our 'MyDurableObject' class above
		let id: DurableObjectId = env.HYPHAL_OBJECT.idFromName(new URL(request.url).pathname);

		// This stub creates a communication channel with the Durable Object instance
		// The Durable Object constructor will be invoked upon the first call for a given id
		let stub = env.HYPHAL_OBJECT.get(id);

		// We call the `sayHello()` RPC method on the stub to invoke the method on the remote
		// Durable Object instance
		let greeting = await stub.sayHello("World");

		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;
