// eslint-disable-next-line import/no-unresolved
import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeEach } from 'vitest';

describe('API Key Validation with Real Environment', () => {
  let userId: string;
  let apiKey: string;
  let username: string;

  beforeEach(async () => {
    // Generate a unique username for each test run
    const uniqueSuffix = Math.floor(Math.random() * 1000000);
    username = `testuser_${uniqueSuffix}`;

    // Create a test user
    const createUserResponse = await SELF.fetch('https://example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key', // Add API key for authentication
      },
      body: JSON.stringify({
        query: `
          mutation {
            createUser(input: {
              username: "${username}",
              password: "password123"
            }) {
              id
            }
          }
        `,
      }),
    });

    expect(createUserResponse.status).toBe(200);
    const createUserData = await createUserResponse.json();
    userId = createUserData.data.createUser.id;
    console.log(`Created user with ID: ${userId}`);

    // Create an API key for the test user
    const createApiKeyResponse = await SELF.fetch('https://example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key', // Add API key for authentication
      },
      body: JSON.stringify({
        query: `
          mutation {
            createApiKeyForUser(input: {
              username: "${username}",
              password: "password123"
            }) {
              apiKey
            }
          }
        `,
      }),
    });

    expect(createApiKeyResponse.status).toBe(200);
    const createApiKeyData = await createApiKeyResponse.json();
    apiKey = createApiKeyData.data.createApiKeyForUser.apiKey;
    console.log(`Created API key: ${apiKey}`);
  });

  it('should validate a valid API key', async () => {
    // Validate the API key
    const validateResponse = await SELF.fetch('https://example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key', // Add API key for authentication
      },
      body: JSON.stringify({
        query: `
          query {
            validateApiKey(apiKey: "${apiKey}") {
              isValid
            }
          }
        `,
      }),
    });

    expect(validateResponse.status).toBe(200);
    const validateData = await validateResponse.json();
    console.log(`Validation result: ${JSON.stringify(validateData)}`);
    expect(validateData.data.validateApiKey.isValid).toBe(true);
  });

  it('should not validate an invalid API key', async () => {
    // Validate an invalid API key
    const validateResponse = await SELF.fetch('https://example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key', // Add API key for authentication
      },
      body: JSON.stringify({
        query: `
          query {
            validateApiKey(apiKey: "invalid-api-key") {
              isValid
            }
          }
        `,
      }),
    });

    expect(validateResponse.status).toBe(200);
    const validateData = await validateResponse.json();
    console.log(`Validation result: ${JSON.stringify(validateData)}`);
    expect(validateData.data.validateApiKey.isValid).toBe(false);
  });

  // Add a test to directly query the database to see the stored key_ciphertext
  it('should directly query the database to see the stored key_ciphertext', async () => {
    // Query the database to get all user_keys
    const queryResponse = await SELF.fetch('https://example.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key', // Use the test API key for authentication
      },
      body: JSON.stringify({
        query: `
          query {
            getAllUserKeys {
              id
              user_id
              key_ciphertext
            }
          }
        `,
      }),
    });

    expect(queryResponse.status).toBe(200);
    const queryData = await queryResponse.json();
    console.log(`All user keys: ${JSON.stringify(queryData)}`);

    // Find the key for our test user
    const userKey = queryData.data.getAllUserKeys.find(key => key.user_id === userId);
    expect(userKey).toBeDefined();
    console.log(`User key: ${JSON.stringify(userKey)}`);

    // Hash the API key to get the expected key_ciphertext
    const encoder = new TextEncoder();
    const apiKeyBytes = encoder.encode(apiKey);
    const apiKeyHash = await crypto.subtle.digest('SHA-256', apiKeyBytes);
    const apiKeyHashArray = new Uint8Array(apiKeyHash);
    const expectedKeyCiphertext = Buffer.from(apiKeyHashArray);
    console.log(`Expected key_ciphertext: ${Array.from(expectedKeyCiphertext)}`);

    // Compare the stored key_ciphertext with the expected key_ciphertext
    // This will help us understand if the issue is with how the key_ciphertext is stored
    // Note: This assumes that the key_ciphertext is returned as a base64 string or similar
    // We may need to adjust this comparison based on how the key_ciphertext is actually returned
    const storedKeyCiphertext = Buffer.from(userKey.key_ciphertext, 'base64');
    console.log(`Stored key_ciphertext: ${Array.from(storedKeyCiphertext)}`);

    // Log the comparison result
    const bufferCompareResult = Buffer.compare(storedKeyCiphertext, expectedKeyCiphertext);
    console.log(`Buffer comparison result: ${bufferCompareResult}`);

    // We expect the comparison to be 0 (equal)
    expect(bufferCompareResult).toBe(0);
  });
});
