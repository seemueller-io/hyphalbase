// eslint-disable-next-line import/no-unresolved
import { describe, expect, it, vi } from 'vitest';

import { Gateway } from '../src/gateway';

// Create a simple test suite that verifies the Gateway class exists and has the expected methods
describe('Gateway', () => {
  it('should have an execute method', () => {
    // Create a mock SqlStorage
    const mockSql = {
      exec: vi.fn(),
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Verify the Gateway instance has an execute method
    expect(gateway.execute).toBeDefined();
    expect(typeof gateway.execute).toBe('function');
  });

  it('should handle create_user operation', async () => {
    // Create a mock SqlStorage that returns expected values
    const mockSql = {
      exec: vi.fn().mockImplementation(() => {
        return {
          toArray: () => [],
        };
      }),
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Mock uuid.v4 to return a consistent value
    vi.mock('uuid', () => ({
      v4: () => 'mock-uuid',
    }));

    // Execute the create_user operation
    const result = await gateway.execute('create_user', {
      username: 'testuser',
      password: 'password123',
      data: {},
    });

    // Verify the result
    expect(result).toHaveProperty('id');
  });

  it('should handle create_api_key_for_user operation', async () => {
    // Create a mock password hash that matches what our mocked digest will return
    const mockPasswordHash = '01020304';

    // Create a mock SqlStorage that returns a user
    const mockSql = {
      exec: vi.fn().mockImplementation((query, ...args) => {
        if (query.includes('SELECT') && query.includes('FROM users')) {
          const result = [{ id: 'user-id', username: 'testuser', password_hash: mockPasswordHash }];
          return {
            toArray: () => result,
            at: index => result[index],
          };
        }
        return {
          toArray: () => [],
        };
      }),
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Mock crypto.subtle.digest to always return the same hash
    const originalSubtle = global.crypto.subtle;
    const mockDigest = vi.fn().mockImplementation(() => {
      // Return a hash that will convert to '01020304' when processed
      return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
    });

    // Use vi.spyOn instead of direct assignment
    vi.spyOn(global.crypto.subtle, 'digest').mockImplementation(mockDigest);

    // Execute the create_api_key_for_user operation
    const result = await gateway.execute('create_api_key_for_user', {
      username: 'testuser',
      password: 'password123',
    });

    // Restore the original implementation
    vi.restoreAllMocks();

    // Verify the result has an apiKey property
    expect(result).toHaveProperty('apiKey');
  });

  it('should handle validate_api_key operation', async () => {
    // Create a mock SqlStorage that returns a user key
    const mockSql = {
      exec: vi.fn().mockImplementation((query, ...args) => {
        if (query.includes('SELECT') && query.includes('FROM user_keys')) {
          const result = [
            {
              id: 'key-id',
              user_id: 'user-id',
              key_ciphertext: new Uint8Array([1, 2, 3, 4]),
              key_iv: new Uint8Array([5, 6, 7, 8]),
            },
          ];
          return {
            toArray: () => result,
            at: index => result[index],
          };
        }
        return {
          toArray: () => [],
        };
      }),
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Mock crypto.subtle.decrypt to return the expected value
    const mockDecrypt = vi.fn().mockImplementation(() => {
      return Promise.resolve(new TextEncoder().encode('test-api-key'));
    });

    // Use vi.spyOn instead of direct assignment
    vi.spyOn(global.crypto.subtle, 'decrypt').mockImplementation(mockDecrypt);

    // Execute the validate_api_key operation
    const result = await gateway.execute('validate_api_key', {
      apiKey: 'test-api-key',
    });

    // Restore the original implementation
    vi.restoreAllMocks();

    // Verify the result
    expect(result).toHaveProperty('isValid');
  });

  it('should handle invalid operation', async () => {
    // Create a mock SqlStorage
    const mockSql = {
      exec: vi.fn(),
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Execute an invalid operation
    // @ts-expect-error - Testing invalid operation
    const result = await gateway.execute('invalid_operation', {});

    // Verify the result
    expect(result).toEqual({ message: 'Invalid operation' });
  });

  it('should use Buffer.from when validating API key', async () => {
    // Create a mock for the SQL exec function
    const mockExec = vi.fn().mockReturnValue({
      toArray: () => [{ id: 'key-id', user_id: 'user-id' }],
    });

    // Create a mock SqlStorage
    const mockSql = {
      exec: mockExec,
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Mock crypto.subtle.digest to return a consistent hash
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(() => {
      return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
    });

    // Execute the validate_api_key operation
    await gateway.execute('validate_api_key', {
      apiKey: 'test-api-key',
    });

    // Find the call to exec that queries the user_keys table
    const userKeysQueryCall = mockExec.mock.calls.find(call => {
      const query = call[0];
      return query.includes('FROM user_keys') && query.includes('WHERE key_ciphertext = ?');
    });

    // Verify that the call exists
    expect(userKeysQueryCall).toBeDefined();

    // Verify that Buffer.from was used (the second argument should be a Buffer)
    const keyParam = userKeysQueryCall[1];
    expect(Buffer.isBuffer(keyParam)).toBe(true);

    // Restore mocks
    vi.restoreAllMocks();
  });

  it('should use Buffer.from when creating API key', async () => {
    // Create a mock for getUser that returns a user
    const mockUser = {
      id: 'user-id',
      username: 'testuser',
      password_hash: '01020304',
    };

    // Create a mock for the SQL exec function
    const mockExec = vi.fn().mockImplementation((query, ...args) => {
      if (query.includes('SELECT') && query.includes('FROM users')) {
        return {
          toArray: () => [mockUser],
        };
      }
      return {
        toArray: () => [],
      };
    });

    // Create a mock SqlStorage
    const mockSql = {
      exec: mockExec,
    };

    // Create a Gateway instance
    const gateway = new Gateway(mockSql);

    // Mock crypto.subtle.digest to return a consistent hash for password validation
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(() => {
      return Promise.resolve(new Uint8Array([1, 2, 3, 4]));
    });

    // Mock crypto.getRandomValues to return consistent values
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      return new Uint8Array([5, 6, 7, 8]);
    });

    // Execute the create_api_key_for_user operation
    await gateway.execute('create_api_key_for_user', {
      username: 'testuser',
      password: 'password123',
    });

    // Find the call to exec that inserts into the user_keys table
    const userKeysInsertCall = mockExec.mock.calls.find(call => {
      const query = call[0];
      return query.includes('INSERT INTO user_keys') && query.includes('VALUES (?, ?, ?, ?)');
    });

    // Verify that the call exists
    expect(userKeysInsertCall).toBeDefined();

    // Verify that Buffer.from was used (the third argument should be a Buffer)
    const keyCiphertextParam = userKeysInsertCall[3];
    expect(Buffer.isBuffer(keyCiphertextParam)).toBe(true);

    // Restore mocks
    vi.restoreAllMocks();
  });
});
