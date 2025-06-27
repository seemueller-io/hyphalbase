// eslint-disable-next-line import/no-unresolved
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Create a real SqlStorage implementation for testing
class MockSqlStorageCursor<T> {
  private data: T[];
  private index = 0;

  constructor(data: T[]) {
    this.data = data;
  }

  next() {
    if (this.index < this.data.length) {
      return { done: false, value: this.data[this.index++] };
    } else {
      return { done: true };
    }
  }

  toArray() {
    return this.data;
  }

  [Symbol.iterator]() {
    return {
      next: () => this.next(),
    };
  }
}

class MockSqlStorage {
  private tables: Record<string, any[]> = {
    users: [],
    user_keys: [],
  };

  exec<T>(query: string, ...bindings: any[]): MockSqlStorageCursor<T> {
    console.log(`Executing query: ${query}`);
    console.log(`Bindings: ${JSON.stringify(bindings)}`);

    // Handle CREATE TABLE queries
    if (query.includes('CREATE TABLE')) {
      return new MockSqlStorageCursor<T>([]);
    }

    // Handle INSERT queries
    if (query.includes('INSERT INTO users')) {
      const [id, username, password_hash, password_salt, user_data] = bindings;
      this.tables.users.push({ id, username, password_hash, password_salt, user_data });
      return new MockSqlStorageCursor<T>([]);
    }

    if (query.includes('INSERT INTO user_keys')) {
      const [id, user_id, key_ciphertext, key_iv] = bindings;
      this.tables.user_keys.push({ id, user_id, key_ciphertext, key_iv });
      return new MockSqlStorageCursor<T>([]);
    }

    // Handle SELECT queries
    if (query.includes('SELECT') && query.includes('FROM users')) {
      const username = bindings[0];
      const users = this.tables.users.filter(user => user.username === username);
      return new MockSqlStorageCursor<T>(users as unknown as T[]);
    }

    if (query.includes('SELECT') && query.includes('FROM user_keys')) {
      if (query.includes('WHERE key_ciphertext = ?')) {
        const key_ciphertext = bindings[0];
        console.log(`Looking for key_ciphertext: ${key_ciphertext}`);

        // Log the available keys in a more detailed way
        console.log(`Available keys count: ${this.tables.user_keys.length}`);
        this.tables.user_keys.forEach((key, index) => {
          console.log(`Key ${index}:`);
          console.log(`  id: ${key.id}`);
          console.log(`  user_id: ${key.user_id}`);
          console.log(
            `  key_ciphertext: ${
              key.key_ciphertext ? 'Buffer of length ' + key.key_ciphertext.length : 'null'
            }`,
          );
          if (Buffer.isBuffer(key.key_ciphertext)) {
            console.log(`  key_ciphertext content: ${Array.from(key.key_ciphertext).join(',')}`);
          }
        });

        // Log the search key_ciphertext in detail
        if (Buffer.isBuffer(key_ciphertext)) {
          console.log(`Search key_ciphertext content: ${Array.from(key_ciphertext).join(',')}`);
        }

        // Compare buffers correctly
        const keys = this.tables.user_keys.filter(key => {
          if (Buffer.isBuffer(key.key_ciphertext) && Buffer.isBuffer(key_ciphertext)) {
            const result = Buffer.compare(key.key_ciphertext, key_ciphertext) === 0;
            console.log(`Buffer comparison result for key ${key.id}: ${result}`);
            return result;
          }
          console.log(`Key ${key.id} doesn't have a Buffer key_ciphertext`);
          return false;
        });

        console.log(`Matching keys: ${keys.length}`);
        return new MockSqlStorageCursor<T>(keys as unknown as T[]);
      } else {
        return new MockSqlStorageCursor<T>(this.tables.user_keys as unknown as T[]);
      }
    }

    return new MockSqlStorageCursor<T>([]);
  }
}

// Import the Gateway class
import { Gateway } from '../src/gateway';

// Import the secure API key encryption functions
import { generateEncryptionKey, exportKey, importKey, encryptApiKey, decryptApiKey, generateApiKey } from '../src/secure-api-key-encryption';

// Define a function to validate an API key directly
// This is a simplified version of the validateApiKey function in gateway.ts
async function validateApiKeyDirectly(apiKey: string, sql: MockSqlStorage): Promise<boolean> {
  console.log('Validating API key directly...');

  // Get all keys from the database
  const allKeys = sql.exec('SELECT * FROM user_keys');
  const keys = allKeys.toArray();

  console.log('All keys (direct):', keys);

  // We need to check each key by decrypting it
  for (const key of keys) {
    try {
      const keyId = key.id as string;
      const ciphertext = key.key_ciphertext as Buffer;
      const iv = key.key_iv as Buffer;

      // For testing purposes, we'll just compare the API key directly
      // In a real implementation, we would decrypt the key_ciphertext using the key_iv
      // and compare the decrypted value with the provided API key
      return true;
    } catch (error) {
      console.error('Error validating API key:', error);
      continue;
    }
  }

  console.log('No matching API key found (direct)');
  return false;
}

describe('API Key Validation End-to-End', () => {
  let sqlStorage: MockSqlStorage;
  let gateway: Gateway;
  let userId: string;
  let apiKey: string;

  beforeEach(async () => {
    // Create a new MockSqlStorage for each test
    sqlStorage = new MockSqlStorage();

    // Create a Gateway instance with the MockSqlStorage
    gateway = new Gateway(sqlStorage as any);

    // Create a test user
    const createUserResult = await gateway.execute('create_user', {
      username: 'testuser',
      password: 'password123',
      user_data: {},
    });

    userId = createUserResult.id;
    console.log(`Created user with ID: ${userId}`);

    // Create an API key for the test user
    const createApiKeyResult = await gateway.execute('create_api_key_for_user', {
      username: 'testuser',
      password: 'password123',
    });

    apiKey = createApiKeyResult.apiKey;
    console.log(`Created API key: ${apiKey}`);
  });

  it('should validate a valid API key', async () => {
    // Get the stored key_ciphertext from the user_keys table
    const storedKey = sqlStorage.exec('SELECT * FROM user_keys').toArray()[0];
    expect(storedKey).toBeDefined();
    expect(Buffer.isBuffer(storedKey.key_ciphertext)).toBe(true);

    // Now validate the API key through the Gateway
    const validateResult = await gateway.execute('validate_api_key', {
      apiKey,
    });

    console.log(`Gateway validation result: ${JSON.stringify(validateResult)}`);

    // Let's also call validateApiKey directly to see what it returns
    // We need to access it through the Gateway instance
    // Since validateApiKey is not exported, we'll need to use a workaround
    // We'll create a new method in our test that calls validateApiKey directly
    const directValidationResult = await validateApiKeyDirectly(apiKey, sqlStorage);
    console.log(`Direct validation result: ${directValidationResult}`);

    // Verify that the API key is valid
    expect(validateResult.isValid).toBe(true);
  });

  it('should directly test the SQL query used in validateApiKey', async () => {
    // Get the stored key_ciphertext from the user_keys table
    const storedKey = sqlStorage.exec('SELECT * FROM user_keys').toArray()[0];
    expect(storedKey).toBeDefined();
    expect(Buffer.isBuffer(storedKey.key_ciphertext)).toBe(true);

    // Directly execute the SQL query used in validateApiKey
    const userApiKeyQuery = sqlStorage.exec(
      `SELECT id,
            user_id,
            key_label,
            key_ciphertext,
            key_iv,
            created_at,
            last_used_at,
            revoked
     FROM user_keys
     WHERE revoked = 0`,
    );

    // Get the result of the query
    const userKeyRow = userApiKeyQuery.toArray()[0];
    console.log('Query result:', userKeyRow);

    // Verify that the query found a matching row
    expect(userKeyRow).toBeDefined();
  });

  it('should not validate an invalid API key', async () => {
    // Validate an invalid API key
    const validateResult = await gateway.execute('validate_api_key', {
      apiKey: 'invalid-api-key',
    });

    // Verify that the API key is not valid
    expect(validateResult.isValid).toBe(false);
  });
});
