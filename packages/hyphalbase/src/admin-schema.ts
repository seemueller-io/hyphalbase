import { Gateway } from './gateway';

const admin_schema = (outer: any & { gateway?: Gateway }) => ({
  typeDefs: /* GraphQL */ `
    type Query {
      # User management queries can be added here if needed
      validateApiKey(apiKey: String!): ValidateApiKeyResponse!
    }

    type Mutation {
      createUser(input: CreateUserInput!): CreateUserResponse!
      createApiKeyForUser(input: CreateApiKeyInput!): CreateApiKeyResponse!
    }

    type UserKey {
      id: String!
      user_id: String!
      key_ciphertext: String!
    }

    input CreateUserInput {
      username: String!
      password: String!
    }

    input CreateApiKeyInput {
      username: String!
      password: String!
    }

    type CreateUserResponse {
      id: String!
    }

    type CreateApiKeyResponse {
      apiKey: String!
    }

    type ValidateApiKeyResponse {
      isValid: Boolean!
    }
  `,
  resolvers: {
    Query: {
      validateApiKey: async (_, { apiKey }) => {
        return await outer.gateway.execute('validate_api_key', { apiKey });
      },
    },
    Mutation: {
      createUser: async (_, { input }) => {
        const { username, password } = input;
        return await outer.gateway.execute('create_user', {
          username,
          password,
          data: {},
        });
      },
      createApiKeyForUser: async (_, { input }) => {
        const { username, password } = input;
        return await outer.gateway.execute('create_api_key_for_user', {
          username,
          password,
        });
      },
    },
  },
});

export default admin_schema;
