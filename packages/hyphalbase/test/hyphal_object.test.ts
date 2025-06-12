import { SELF, env, runInDurableObject } from "cloudflare:test";
import { expect, it, describe } from "vitest";
import { HyphalObject } from "../src/hyphal_object";
import { SQLiteDurableObject } from '../src';

describe("HyphalObject", () => {
	it("should create a hyphal object", async () => {
		const id = env.SQL.idFromName("/gql");
		const stub = env.SQL.get(id);
		const hyphalObject  = await runInDurableObject(stub, (instance: SQLiteDurableObject) => {
			expect(instance).toBeInstanceOf(SQLiteDurableObject); // Exact same class as import
			return new HyphalObject(instance.ctx.storage.sql);
		});
		expect(hyphalObject).toBeDefined();
	});

	it("should create a hyphal object with a custom namespace", async () => {
		const id = env.SQL.idFromName("/custom-namespace");
		const stub = env.SQL.get(id);
		const hyphalObject = await runInDurableObject(stub, (instance: SQLiteDurableObject) => {
			return new HyphalObject(instance.ctx.storage.sql);
		});
		expect(hyphalObject).toBeDefined();
	});

	// Test persistence between multiple calls to the same Durable Object
	it("should persist data between multiple calls to the same Durable Object", async () => {
		const id = env.SQL.idFromName("/persistence-test");
		const stub = env.SQL.get(id);

		// First call: Store a vector
		const vectorId = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
			const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
			const result = await hyphalObject.execute('put', {
				namespace: "test-persistence",
				content: "persistence test content",
				vector: [0.5, 0.6, 0.7]
			});
			return result.id;
		});

		expect(vectorId).toBeDefined();

		// Second call: Retrieve the vector
		const vector = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
			const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
			return await hyphalObject.execute('get', { id: vectorId });
		});

		expect(vector).toBeDefined();
		expect(vector.id).toBe(vectorId);
		expect(vector.namespace).toBe("test-persistence");
		expect(vector.content).toBe("persistence test content");
		expect(vector.vector.length).toBe(3);
		expect(Math.abs(vector.vector[0] - 0.5)).toBeLessThan(0.0001);
		expect(Math.abs(vector.vector[1] - 0.6)).toBeLessThan(0.0001);
		expect(Math.abs(vector.vector[2] - 0.7)).toBeLessThan(0.0001);
	});

	// Test persistence after recreating the Durable Object
	it("should persist data after recreating the Durable Object", async () => {
		const id = env.SQL.idFromName("/persistence-recreate-test");
		const stub = env.SQL.get(id);

		// First: Store a vector
		const vectorId = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
			const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
			const result = await hyphalObject.execute('put', {
				namespace: "test-recreate",
				content: "recreate test content",
				vector: [0.8, 0.9, 1.0]
			});
			return result.id;
		});

		expect(vectorId).toBeDefined();

		// Now get the same Durable Object again (simulating a new request)
		const sameId = env.SQL.idFromName("/persistence-recreate-test");
		const sameStub = env.SQL.get(sameId);

		// Retrieve the vector from the "new" Durable Object instance
		const vector = await runInDurableObject(sameStub, async (instance: SQLiteDurableObject) => {
			const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
			return await hyphalObject.execute('get', { id: vectorId });
		});

		expect(vector).toBeDefined();
		expect(vector.id).toBe(vectorId);
		expect(vector.namespace).toBe("test-recreate");
		expect(vector.content).toBe("recreate test content");
		expect(vector.vector.length).toBe(3);
		expect(Math.abs(vector.vector[0] - 0.8)).toBeLessThan(0.0001);
		expect(Math.abs(vector.vector[1] - 0.9)).toBeLessThan(0.0001);
		expect(Math.abs(vector.vector[2] - 1.0)).toBeLessThan(0.0001);
	});

  // Test cosine similarity calculation (pure function, doesn't need Durable Object)
  describe("Cosine similarity", () => {
    it("should calculate cosine similarity correctly", () => {
      // Identical vectors should have similarity 1
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      expect(HyphalObject.cosineSimilarity(vecA, vecB)).toBeCloseTo(1, 5);

      // Orthogonal vectors should have similarity 0
      const vecC = [1, 0, 0];
      const vecD = [0, 1, 0];
      expect(HyphalObject.cosineSimilarity(vecC, vecD)).toBeCloseTo(0, 5);

      // Opposite vectors should have similarity -1
      const vecE = [1, 2, 3];
      const vecF = [-1, -2, -3];
      expect(HyphalObject.cosineSimilarity(vecE, vecF)).toBeCloseTo(-1, 5);

      // Zero vectors should have similarity 0
      const vecG = [0, 0, 0];
      const vecH = [1, 2, 3];
      expect(HyphalObject.cosineSimilarity(vecG, vecH)).toBe(0);
      expect(HyphalObject.cosineSimilarity(vecH, vecG)).toBe(0);
      expect(HyphalObject.cosineSimilarity(vecG, vecG)).toBe(0);
    });
  });
});
