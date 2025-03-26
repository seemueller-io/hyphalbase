import { beforeEach, describe, expect, it } from "vitest";

import { HyphalSDK, PutOptions, SearchResult } from "../index";

describe("HyphalSDK Live Instance Tests", async () => {
	let sdk: HyphalSDK;

	// Replace this URL with your live endpoint
	const liveBaseUrl = "http://localhost:8787";

	beforeEach(() => {
		// Initialize the SDK with the live base URL
		sdk = new HyphalSDK(liveBaseUrl);
	});

	it("should insert or update a vector record on a live instance", async () => {
		const input: PutOptions = {
			namespace: "test-namespace",
			vector: [1.0, 2.0, 3.0],
			content: "test-content"
		};

		// Execute the PUT operation
		const result = await sdk.put(input);

		// Assuming the live endpoint returns an ID in the response
		expect(result).toHaveProperty("id");
		expect(typeof result.id).toBe("string");
	});

	it("should retrieve a vector record by id on a live instance", async () => {
		const testId = "test-id"; // Replace with a valid ID from a live system

		// 1. Add the vector to the store (replace with your actual add logic)
		await sdk.put({
			id: testId,
			content: "test-content",
			namespace: "test-namespace",
			vector: [1.0, 2.0, 3.0]
		});

		// 2. Wait for the vector to be indexed (example using a simple delay)
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjust delay as needed

		// Execute the GET operation
		const result = await sdk.get(testId);

		// Perform assertions
		expect(result).toHaveProperty("id", testId);
		expect(result).toHaveProperty("namespace", "test-namespace");
		expect(result).toHaveProperty("content");
		expect(result).toHaveProperty("vector");
		expect(Array.isArray(result.vector)).toBe(true);
	});

	it("should delete a vector record by id on a live instance", async () => {
		const testId = "test-id"; // Replace with a valid ID from a live system

		// Execute the DELETE operation
		const result = await sdk.delete(testId);

		// Check for a success response
		expect(result).toBe("Vector deleted successfully");
	});

	it("should delete all vector records on a live instance", async () => {
		// Execute the DELETE ALL operation
		const result = await sdk.deleteAll();

		// Check for a success response
		expect(result).toBe("All vectors deleted successfully");
	});

	it("should search for similar vectors on a live instance", async () => {
		await sdk.put({
			id: "abasdsa",
			content: "test-content",
			namespace: "test-namespace",
			vector: [1.0, 2.0, 3.0]
		});

		const queryVector = [0.5, 0.6, 0.7];
		const topN = 2;

		// Execute the SEARCH operation
		const result = await sdk.search(queryVector, topN);

		// Check if search results are returned
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBeGreaterThan(0);

		// Validate the structure of a search result
		result.forEach((item: SearchResult) => {
			expect(item).toHaveProperty("id");
			expect(item).toHaveProperty("namespace");
			expect(item).toHaveProperty("content");
			expect(item).toHaveProperty("similarity");
			expect(typeof item.similarity).toBe("number");
		});
	});
});
