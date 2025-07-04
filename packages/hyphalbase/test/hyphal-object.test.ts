// eslint-disable-next-line import/no-unresolved
import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { SQLiteDurableObject } from '../src';
import { Gateway } from '../src/gateway';
import { HyphalObject } from '../src/hyphal-object';

// Helper function to create a real Gateway with a test user
async function createRealGateway(sql) {
  const gateway = new Gateway(sql);

  // Create a unique username for this test
  const uniqueUsername = `test-user-${Math.random().toString(36).substring(2, 10)}`;

  // Create a test user
  await gateway.execute('create_user', {
    username: uniqueUsername,
    password: 'test-password',
    user_data: {},
  });

  // Create an API key for the user
  const { apiKey } = await gateway.execute('create_api_key_for_user', {
    username: uniqueUsername,
    password: 'test-password',
  });

  // Authenticate with the API key
  await gateway.execute('get_user_from_key', {
    apiKey,
  });

  return gateway;
}

describe('HyphalObject', () => {
  it('should create a hyphal object', async () => {
    const id = env.SQL.idFromName('/gql');
    const stub = env.SQL.get(id);
    const hyphalObject = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      expect(instance).toBeInstanceOf(SQLiteDurableObject); // Exact same class as import
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      return new HyphalObject(instance.ctx.storage.sql, gateway);
    });
    expect(hyphalObject).toBeDefined();
  });

  it('should create a hyphal object with a custom namespace', async () => {
    const id = env.SQL.idFromName('/custom-namespace');
    const stub = env.SQL.get(id);
    const hyphalObject = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      return new HyphalObject(instance.ctx.storage.sql, gateway);
    });
    expect(hyphalObject).toBeDefined();
  });

  // Test persistence between multiple calls to the same Durable Object
  it('should persist data between multiple calls to the same Durable Object', async () => {
    const id = env.SQL.idFromName('/persistence-test');
    const stub = env.SQL.get(id);

    // First call: Store a vector
    const vectorId = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      const result = await hyphalObject.execute('put', {
        namespace: 'test-persistence',
        content: 'persistence test content',
        vector: [0.5, 0.6, 0.7],
      });
      return result.id;
    });

    expect(vectorId).toBeDefined();

    // Second call: Retrieve the vector
    const vector = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      return await hyphalObject.execute('get', { id: vectorId });
    });

    expect(vector).toBeDefined();
    expect(vector.id).toBe(vectorId);
    expect(vector.namespace).toBe('test-persistence');
    expect(vector.content).toBe('persistence test content');
    expect(vector.vector.length).toBe(3);
    expect(Math.abs(vector.vector[0] - 0.5)).toBeLessThan(0.0001);
    expect(Math.abs(vector.vector[1] - 0.6)).toBeLessThan(0.0001);
    expect(Math.abs(vector.vector[2] - 0.7)).toBeLessThan(0.0001);
  });

  // Test persistence after recreating the Durable Object
  it('should persist data after recreating the Durable Object', async () => {
    const id = env.SQL.idFromName('/persistence-recreate-test');
    const stub = env.SQL.get(id);

    // First: Store a vector
    const vectorId = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      const result = await hyphalObject.execute('put', {
        namespace: 'test-recreate',
        content: 'recreate test content',
        vector: [0.8, 0.9, 1.0],
      });
      return result.id;
    });

    expect(vectorId).toBeDefined();

    // Now get the same Durable Object again (simulating a new request)
    const sameId = env.SQL.idFromName('/persistence-recreate-test');
    const sameStub = env.SQL.get(sameId);

    // Retrieve the vector from the "new" Durable Object instance
    const vector = await runInDurableObject(sameStub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      return await hyphalObject.execute('get', { id: vectorId });
    });

    expect(vector).toBeDefined();
    expect(vector.id).toBe(vectorId);
    expect(vector.namespace).toBe('test-recreate');
    expect(vector.content).toBe('recreate test content');
    expect(vector.vector.length).toBe(3);
    expect(Math.abs(vector.vector[0] - 0.8)).toBeLessThan(0.0001);
    expect(Math.abs(vector.vector[1] - 0.9)).toBeLessThan(0.0001);
    expect(Math.abs(vector.vector[2] - 1.0)).toBeLessThan(0.0001);
  });

  // Test bulk vector insertion
  it('should insert multiple vectors at once and retrieve them individually', async () => {
    const id = env.SQL.idFromName('/bulk-insert-test');
    const stub = env.SQL.get(id);

    // Define test vectors
    const testVectors = [
      {
        namespace: 'test-bulk-1',
        content: 'bulk test content 1',
        vector: [0.1, 0.2, 0.3],
      },
      {
        namespace: 'test-bulk-2',
        content: 'bulk test content 2',
        vector: [0.4, 0.5, 0.6],
      },
      {
        namespace: 'test-bulk-3',
        content: 'bulk test content 3',
        vector: [0.7, 0.8, 0.9],
      },
    ];

    // Insert vectors using bulkPut
    const result = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      return await hyphalObject.execute('bulkPut', {
        vectors: testVectors,
      });
    });

    expect(result).toBeDefined();
    expect(result.message).toBe('Bulk insert succeeded');
    expect(result.ids).toBeDefined();
    expect(result.ids.length).toBe(testVectors.length);

    // Retrieve and verify each vector directly using the returned IDs
    for (let i = 0; i < testVectors.length; i++) {
      const vector = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
        const gateway = await createRealGateway(instance.ctx.storage.sql);
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
        return await hyphalObject.execute('get', {
          id: result.ids[i],
        });
      });

      expect(vector).toBeDefined();
      expect(vector.namespace).toBe(testVectors[i].namespace);
      expect(vector.content).toBe(testVectors[i].content);
      expect(vector.vector.length).toBe(testVectors[i].vector.length);

      // Check that vector values are approximately equal
      for (let j = 0; j < testVectors[i].vector.length; j++) {
        expect(Math.abs(vector.vector[j] - testVectors[i].vector[j])).toBeLessThan(0.0001);
      }
    }
  });

  // Test bulk delete operation
  it('should delete multiple vectors at once', async () => {
    const id = env.SQL.idFromName('/bulk-delete-test');
    const stub = env.SQL.get(id);

    // Define test vectors
    const testVectors = [
      {
        namespace: 'test-bulk-delete-1',
        content: 'bulk delete test content 1',
        vector: [0.1, 0.2, 0.3],
      },
      {
        namespace: 'test-bulk-delete-2',
        content: 'bulk delete test content 2',
        vector: [0.4, 0.5, 0.6],
      },
      {
        namespace: 'test-bulk-delete-3',
        content: 'bulk delete test content 3',
        vector: [0.7, 0.8, 0.9],
      },
    ];

    // Insert vectors and collect their IDs
    const vectorIds = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      const ids = [];

      // Insert each vector individually to get their IDs
      for (const vector of testVectors) {
        const result = await hyphalObject.execute('put', {
          namespace: vector.namespace,
          content: vector.content,
          vector: vector.vector,
        });
        ids.push(result.id);
      }

      return ids;
    });

    expect(vectorIds.length).toBe(3);

    // Verify vectors were inserted
    for (let i = 0; i < vectorIds.length; i++) {
      const vector = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
        const gateway = await createRealGateway(instance.ctx.storage.sql);
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
        try {
          return await hyphalObject.execute('get', {
            id: vectorIds[i],
          });
        } catch (error) {
          return null;
        }
      });
      expect(vector).not.toBeNull();
    }

    // Delete all vectors at once
    const deleteResult = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
      const gateway = await createRealGateway(instance.ctx.storage.sql);
      const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
      return await hyphalObject.execute('delete', { ids: vectorIds });
    });

    expect(deleteResult).toBeDefined();
    expect(deleteResult.message).toBe('Delete Succeeded');

    // Verify vectors were deleted
    for (let i = 0; i < vectorIds.length; i++) {
      const vector = await runInDurableObject(stub, async (instance: SQLiteDurableObject) => {
        const gateway = await createRealGateway(instance.ctx.storage.sql);
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql, gateway);
        try {
          return await hyphalObject.execute('get', {
            id: vectorIds[i],
          });
        } catch (error) {
          return null;
        }
      });
      expect(vector).toBeNull();
    }
  });

  // Test cosine similarity calculation (pure function, doesn't need Durable Object)
  describe('Cosine similarity', () => {
    it('should calculate cosine similarity correctly', () => {
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
    });
  });
});
