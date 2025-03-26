export interface VectorRecord {
	id: string;
	namespace: string;
	vector: number[];
	content: string;
}

export interface SearchResult {
	id: string;
	namespace: string;
	content: string;
	similarity: number;
}

export interface PutOptions {
	id?: string;
	namespace: string;
	vector: number[];
	content: string;
}

export class HyphalSDK {
	// baseUrl should be the URL of your deployed Worker/Durable Object endpoint.
	// For local development you might use something like "http://localhost:8787"
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	/**
	 * Insert or update a vector record.
	 * @param options An object containing namespace, vector, content and an optional id.
	 * @returns A Promise that resolves to an object with the record's id.
	 */
	async put(options: PutOptions): Promise<{ id: string }> {
		const res = await fetch(this.baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "put",
				payload: options
			})
		});
		if (!res.ok) {
			throw new Error(`Failed to put vector: ${await res.text()}`);
		}
		return res.json();
	}

	/**
	 * Retrieve a vector record by id.
	 * @param id - The UUID of the vector record.
	 * @returns A Promise that resolves to the record.
	 */
	async get(id: string): Promise<VectorRecord> {
		const res = await fetch(this.baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "get",
				payload: { id }
			})
		});
		if (!res.ok) {
			throw new Error(`Failed to get vector: ${await res.text()}`);
		}
		return res.json();
	}

	/**
	 * Delete a vector record by id.
	 * @param id - The UUID of the vector record.
	 * @returns A Promise that resolves to a success message.
	 */
	async delete(id: string): Promise<string> {
		const res = await fetch(this.baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "delete",
				payload: { id }
			})
		});
		if (!res.ok) {
			throw new Error(`Failed to delete vector: ${await res.text()}`);
		}
		return res.text();
	}

	/**
	 * Delete all vector records.
	 * @returns A Promise that resolves to a success message.
	 */
	async deleteAll(): Promise<string> {
		const res = await fetch(this.baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ operation: "deleteAll" })
		});
		if (!res.ok) {
			throw new Error(`Failed to delete all vectors: ${await res.text()}`);
		}
		return res.text();
	}

	/**
	 * Search for similar vectors.
	 * @param vector - A target vector to compare against.
	 * @param topN - Optional number specifying how many top results to return.
	 * @returns A Promise that resolves to an array of search results.
	 */
	async search(vector: number[], topN?: number): Promise<SearchResult[]> {
		const res = await fetch(this.baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "search",
				payload: { vector, topN }
			})
		});
		if (!res.ok) {
			console.log(res);
			throw new Error(`Failed to search vectors: ${await res.text()}`);
		}
		return res.json();
	}
}
