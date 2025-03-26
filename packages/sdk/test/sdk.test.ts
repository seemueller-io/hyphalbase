import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HyphalSDK, PutOptions, SearchResult, VectorRecord } from "../index";

describe("HyphalSDK", () => {
	let sdk: HyphalSDK;

	const mockBaseUrl = "http://localhost:8787";

	// Mock fetch API
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
		sdk = new HyphalSDK(mockBaseUrl);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should insert or update a vector record", async () => {
		const input: PutOptions = {
			namespace: "test-namespace",
			vector: [1.0, 2.0, 3.0],
			content: "test-content"
		};

		// Mock fetch response
		(fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: "test-id" })
		});

		const result = await sdk.put(input);

		expect(result).toEqual({ id: "test-id" });
		expect(fetch).toHaveBeenCalledWith(mockBaseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "put",
				payload: input
			})
		});
	});

	it("should retrieve a vector record by id", async () => {
		const mockVector: VectorRecord = {
			id: "test-id",
			namespace: "test-namespace",
			vector: [1.0, 2.0, 3.0],
			content: "test-content"
		};

		// Mock fetch response
		(fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockVector
		});

		const result = await sdk.get("test-id");

		expect(result).toEqual(mockVector);
		expect(fetch).toHaveBeenCalledWith(mockBaseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "get",
				payload: { id: "test-id" }
			})
		});
	});

	it("should delete a vector record by id", async () => {
		const successMessage = "Vector deleted successfully";

		// Mock fetch response
		(fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => successMessage
		});

		const result = await sdk.delete("test-id");

		expect(result).toEqual(successMessage);
		expect(fetch).toHaveBeenCalledWith(mockBaseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "delete",
				payload: { id: "test-id" }
			})
		});
	});

	it("should delete all vector records", async () => {
		const successMessage = "All records deleted successfully";

		// Mock fetch response
		(fetch as any).mockResolvedValueOnce({
			ok: true,
			text: async () => successMessage
		});

		const result = await sdk.deleteAll();

		expect(result).toEqual(successMessage);
		expect(fetch).toHaveBeenCalledWith(mockBaseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ operation: "deleteAll" })
		});
	});

	it("should search for similar vectors", async () => {
		const mockSearchResults: SearchResult[] = [
			{
				id: "result-1",
				namespace: "test-namespace",
				content: "result-1-content",
				similarity: 0.9
			},
			{
				id: "result-2",
				namespace: "test-namespace",
				content: "result-2-content",
				similarity: 0.85
			}
		];
		const queryVector = [0.5, 0.6, 0.7];
		const topN = 2;

		// Mock fetch response
		(fetch as any).mockResolvedValueOnce({
			ok: true,
			json: async () => mockSearchResults
		});

		const result = await sdk.search(queryVector, topN);

		expect(result).toEqual(mockSearchResults);
		expect(fetch).toHaveBeenCalledWith(mockBaseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				operation: "search",
				payload: { vector: queryVector, topN }
			})
		});
	});
});
