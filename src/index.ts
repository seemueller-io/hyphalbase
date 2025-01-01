import {HyphalObject} from "./hyphal_object";

export {HyphalObject};

export default {
	async fetch(request, env, ctx): Promise<Response> {

		let id: DurableObjectId = env.HYPHAL_OBJECT.idFromName(new URL(request.url).pathname);

		let stub = env.HYPHAL_OBJECT.get(id);

		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;
