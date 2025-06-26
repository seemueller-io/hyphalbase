import { GraphQLClient } from 'graphql-request';
import { GET_VECTOR, SEARCH_VECTORS, PUT_VECTOR, DELETE_VECTOR } from './operations/vectors';
import {
	GET_DOCUMENT,
	SEARCH_DOCUMENTS,
	STORE_DOCUMENT,
	DELETE_DOCUMENT,
} from './operations/documents';
import { EMBED, DELETE_ALL_VECTORS } from './operations/misc';

// This file will be updated with the generated types after running the code generation
// For now, we'll create a basic client implementation

export class HyphalbaseClient {
	private client: GraphQLClient;

	constructor(endpoint: string, headers?: HeadersInit) {
		this.client = new GraphQLClient(endpoint, { headers });
	}

	/**
	 * Get a vector by ID
	 */
	async getVector(id: string) {
		return this.client.request(GET_VECTOR, { id });
	}

	/**
	 * Search vectors by vector similarity
	 */
	async searchVectors(vector: number[], topN?: number) {
		return this.client.request(SEARCH_VECTORS, { vector, topN });
	}

	/**
	 * Put a vector
	 */
	async putVector(input: { id?: string; namespace: string; content: string; vector: number[] }) {
		return this.client.request(PUT_VECTOR, { input });
	}

	/**
	 * Delete vectors by IDs
	 */
	async deleteVector(ids: string | string[]) {
		const idsArray = Array.isArray(ids) ? ids : [ids];
		return this.client.request(DELETE_VECTOR, { ids: idsArray });
	}

	/**
	 * Generate embeddings for content
	 */
	async embed(content: string) {
		return this.client.request(EMBED, { content });
	}

	/**
	 * Delete all vectors
	 */
	async deleteAllVectors() {
		return this.client.request(DELETE_ALL_VECTORS, {});
	}

	/**
	 * Get a document by ID
	 */
	async getDocument(id: string) {
		return this.client.request(GET_DOCUMENT, { id });
	}

	/**
	 * Search documents by content similarity
	 */
	async searchDocuments(query: string, topN?: number) {
		return this.client.request(SEARCH_DOCUMENTS, { query, topN });
	}

	/**
	 * Store a document
	 */
	async storeDocument(input: { id?: string; namespace: string; content: string }) {
		return this.client.request(STORE_DOCUMENT, { input });
	}

	/**
	 * Delete documents by IDs
	 */
	async deleteDocument(ids: string | string[]) {
		const idsArray = Array.isArray(ids) ? ids : [ids];
		return this.client.request(DELETE_DOCUMENT, { ids: idsArray });
	}
}

// Export the operations for advanced usage
export {
	GET_VECTOR,
	SEARCH_VECTORS,
	PUT_VECTOR,
	DELETE_VECTOR,
	GET_DOCUMENT,
	SEARCH_DOCUMENTS,
	STORE_DOCUMENT,
	DELETE_DOCUMENT,
	EMBED,
	DELETE_ALL_VECTORS,
};

// Default export
export default HyphalbaseClient;
