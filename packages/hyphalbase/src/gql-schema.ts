import { HyphalObject } from './hyphal_object';

const schema = (outer: any & { hyphal_object: HyphalObject }) => ({
	typeDefs: /* GraphQL */ `
		type Query {
			getVector(id: String!): Vector
			searchVectors(vector: [Float!]!, topN: Int): [ScoredVector!]!
			embed(content: String!): EmbedResponse!
		}

		type Mutation {
			putVector(input: PutVectorInput!): PutVectorResponse!
			deleteVector(id: String!): OkMessage!
			deleteAllVectors: OkMessage!
		}

		input PutVectorInput {
			id: String
			namespace: String!
			content: String!
			vector: [Float!]!
		}

		type PutVectorResponse {
			id: String!
		}

		type EmbedResponse {
			embeddings: [Float!]!
		}

		type Vector {
			id: String!
			namespace: String!
			vector: [Float!]!
			content: String!
		}

		type ScoredVector {
			id: String!
			namespace: String!
			content: String!
			score: Float!
		}

		type OkMessage {
			message: String!
		}
	`,
	resolvers: {
		Query: {
			getVector: async (_, { id }) => {
				try {
					return await outer.hyphal_object.execute('get', { id });
				} catch (error) {
					return null;
				}
			},
			embed: async (_, { content }) => {
				return await outer.hyphal_object.execute('embed', { content });
			},
			searchVectors: async (_, { vector, topN }) => {
				return await outer.hyphal_object.execute('search', { vector, topN });
			},
		},
		Mutation: {
			putVector: async (_, { input }) => {
				const { id, namespace, content, vector } = input;
				return await outer.hyphal_object.execute('put', { id, namespace, content, vector });
			},
			deleteVector: async (_, { id }) => {
				return await outer.hyphal_object.execute('delete', { id });
			},
			deleteAllVectors: async () => {
				return await outer.hyphal_object.execute('deleteAll', {});
			},
		},
	},
});

export default schema;
