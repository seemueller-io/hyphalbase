// eslint-disable-next-line import/no-unresolved
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Create a mock SqlStorage for testing
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
      this.tables.users.push({
        id,
        username,
        password_hash,
        password_salt,
        user_data,
      });
      return new MockSqlStorageCursor<T>([]);
    }

    if (query.includes('INSERT INTO user_keys')) {
      const [id, user_id, key_ciphertext, key_iv] = bindings;
      this.tables.user_keys.push({
        id,
        user_id,
        key_ciphertext,
        key_iv,
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked: 0,
      });
      return new MockSqlStorageCursor<T>([]);
    }

    // Handle UPDATE queries
    if (query.includes('UPDATE user_keys')) {
      const keyId = bindings[0];
      const keyIndex = this.tables.user_keys.findIndex(key => key.id === keyId);
      if (keyIndex >= 0) {
        this.tables.user_keys[keyIndex].last_used_at = new Date().toISOString();
      }
      return new MockSqlStorageCursor<T>([]);
    }

    // Handle SELECT queries
    if (query.includes('SELECT') && query.includes('FROM users')) {
      const username = bindings[0];
      const users = this.tables.users.filter(user => user.username === username);
      return new MockSqlStorageCursor<T>(users as unknown as T[]);
    }

    if (query.includes('SELECT') && query.includes('FROM user_keys')) {
      if (query.includes('WHERE revoked = 0')) {
        const keys = this.tables.user_keys.filter(key => key.revoked === 0);
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

describe('Secure API Key Encryption Integration', () => {
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
    // Validate the API key
    const validateResult = await gateway.execute('validate_api_key', {
      apiKey,
    });

    console.log(`Validation result: ${JSON.stringify(validateResult)}`);

    // Verify that the API key is valid
    expect(validateResult.isValid).toBe(true);
  });

  it('should not validate an invalid API key', async () => {
    // Validate an invalid API key
    const validateResult = await gateway.execute('validate_api_key', {
      apiKey: 'invalid-api-key',
    });

    console.log(`Validation result: ${JSON.stringify(validateResult)}`);

    // Verify that the API key is not valid
    expect(validateResult.isValid).toBe(false);
  });

  it('should update last_used_at when validating a valid API key', async () => {
    // Get the API key before validation
    const keysBeforeValidation = sqlStorage.exec('SELECT * FROM user_keys').toArray();
    expect(keysBeforeValidation.length).toBe(1);
    expect(keysBeforeValidation[0].last_used_at).toBeNull();

    // Validate the API key
    const validateResult = await gateway.execute('validate_api_key', {
      apiKey,
    });

    // Verify that the API key is valid
    expect(validateResult.isValid).toBe(true);

    // Get the API key after validation
    const keysAfterValidation = sqlStorage.exec('SELECT * FROM user_keys').toArray();
    expect(keysAfterValidation.length).toBe(1);
    expect(keysAfterValidation[0].last_used_at).not.toBeNull();
  });
});
