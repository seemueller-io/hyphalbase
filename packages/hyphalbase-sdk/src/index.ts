import { GraphQLClient } from 'graphql-request';
import { GET_VECTOR, SEARCH_VECTORS, PUT_VECTOR, DELETE_VECTOR } from './operations/vectors';

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
  async putVector(input: {
    id?: string;
    namespace: string;
    content: string;
    vector: number[];
  }) {
    return this.client.request(PUT_VECTOR, { input });
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(id: string) {
    return this.client.request(DELETE_VECTOR, { id });
  }
}

// Export the operations for advanced usage
export { GET_VECTOR, SEARCH_VECTORS, PUT_VECTOR, DELETE_VECTOR };

// Default export
export default HyphalbaseClient;
