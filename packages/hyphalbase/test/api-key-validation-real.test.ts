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
    const createUserResponse = await SELF.fetch('https://example.com/admin', {
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
    const createApiKeyResponse = await SELF.fetch('https://example.com/admin', {
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
    const validateResponse = await SELF.fetch('https://example.com/admin', {
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
    const validateResponse = await SELF.fetch('https://example.com/admin', {
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
});
