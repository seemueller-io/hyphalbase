import { HyphalObject } from './hyphal-object';

const schema = (outer: any & { hyphal_object?: HyphalObject }) => ({
	typeDefs: /* GraphQL */ `
		type Query {
			getVector(id: String!): Vector
			searchVectors(vector: [Float!]!, topN: Int): [ScoredVector!]!
			embed(content: String!): EmbedResponse!
			getDocument(id: String!): Document
			searchDocuments(query: String!, topN: Int): [ScoredDocument!]!
		}

		type Mutation {
			putVector(input: PutVectorInput!): PutVectorResponse!
			deleteVector(ids: [String!]!): OkMessage!
			deleteAllVectors: OkMessage!
			storeDocument(input: StoreDocumentInput!): StoreDocumentResponse!
			deleteDocument(ids: [String!]!): OkMessage!
		}

		input PutVectorInput {
			id: String
			namespace: String!
			content: String!
			vector: [Float!]!
		}

		input StoreDocumentInput {
			id: String
			namespace: String!
			content: String!
		}

		type PutVectorResponse {
			id: String!
		}

		type StoreDocumentResponse {
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

		type Document {
			id: String!
			namespace: String!
			content: String!
		}

		type ScoredVector {
			id: String!
			namespace: String!
			content: String!
			score: Float!
		}

		type ScoredDocument {
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
				return await outer.hyphal_object.execute('search', {
					vector,
					topN,
				});
			},
			getDocument: async (_, { id }) => {
				try {
					return await outer.hyphal_object.execute('getDocument', {
						id,
					});
				} catch (error) {
					return null;
				}
			},
			searchDocuments: async (_, { query, topN }) => {
				return await outer.hyphal_object.execute('searchDocuments', {
					query,
					topN,
				});
			},
		},
		Mutation: {
			putVector: async (_, { input }) => {
				const { id, namespace, content, vector } = input;
				return await outer.hyphal_object.execute('put', {
					id,
					namespace,
					content,
					vector,
				});
			},
			deleteVector: async (_, { ids }) => {
				return await outer.hyphal_object.execute('delete', { ids });
			},
			deleteAllVectors: async () => {
				return await outer.hyphal_object.execute('deleteAll', {});
			},
			storeDocument: async (_, { input }) => {
				const { id, namespace, content } = input;
				return await outer.hyphal_object.execute('storeDocument', {
					id,
					namespace,
					content,
				});
			},
			deleteDocument: async (_, { ids }) => {
				return await outer.hyphal_object.execute('deleteDocument', {
					ids,
				});
			},
		},
	},
});

export default schema;
