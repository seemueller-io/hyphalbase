import { GraphQLError } from 'graphql';

import { HyphalObject } from './hyphal-object';

interface Context {
  apiKey?: string;
}

interface GraphQLResolverInfo {
  fieldName: string;
  fieldNodes: any[];
  returnType: any;
  parentType: any;
  path: any;
  schema: any;
  fragments: any;
  rootValue: any;
  operation: any;
  variableValues: any;
}

type ResolverFunction<TArgs = any, TResult = any> = (
  parent: any,
  args: TArgs,
  context: Context,
  info: GraphQLResolverInfo,
) => Promise<TResult> | TResult;

// Protected wrapper function
const protectedOp = <TArgs = any, TResult = any>(
  outer: any,
  resolver: ResolverFunction<TArgs, TResult>,
): ResolverFunction<TArgs, TResult> => {
  return async (parent: any, args: TArgs, context: Context, info: GraphQLResolverInfo) => {
    const { apiKey } = context;

    // Validate API key if provided
    if (apiKey) {
      const { isValid } = await outer.gateway.execute('validate_api_key', { apiKey });
      if (!isValid) {
        throw new GraphQLError('Invalid API key');
        // throw new Error('Invalid API key');
      }
    }

    // Execute the original resolver
    return resolver(parent, args, context, info);
  };
};

const schema = (outer: any & { hyphal_object?: HyphalObject }) => ({
  typeDefs: /* GraphQL */ `
    type Query {
      getVector(id: String!): Vector
      searchVectors(vector: [Float!]!, topN: Int): [ScoredVector!]!
      embed(content: String!): EmbedResponse!
      getDocument(id: String!): Document
      searchDocuments(query: String!, topN: Int): [ScoredDocument!]!
    }

    type Mutation {
      putVector(input: PutVectorInput!): PutVectorResponse!
      deleteVector(ids: [String!]!): OkMessage!
      deleteAllVectors: OkMessage!
      storeDocument(input: StoreDocumentInput!): StoreDocumentResponse!
      deleteDocument(ids: [String!]!): OkMessage!
    }

    input PutVectorInput {
      id: String
      namespace: String!
      content: String!
      vector: [Float!]!
    }

    input StoreDocumentInput {
      id: String
      namespace: String!
      content: String!
    }

    type PutVectorResponse {
      id: String!
    }

    type StoreDocumentResponse {
      id: String!
    }

    type EmbedResponse {
      embeddings: [Float!]!
    }

    type Vector {
      id: String!
      namespace: String!
      vector: [Float!]!
      content: String!
    }

    type Document {
      id: String!
      namespace: String!
      content: String!
    }

    type ScoredVector {
      id: String!
      namespace: String!
      content: String!
      score: Float!
    }

    type ScoredDocument {
      id: String!
      namespace: String!
      content: String!
      score: Float!
    }

    type OkMessage {
      message: String!
    }
  `,
  resolvers: {
    Query: {
      getVector: protectedOp(outer, async (_, { id }) => {
        try {
          return await outer.hyphal_object.execute('get', { id });
        } catch (error) {
          return null;
        }
      }),
      embed: protectedOp(outer, async (_, { content }) => {
        return await outer.hyphal_object.execute('embed', { content });
      }),
      searchVectors: protectedOp(outer, async (_, { vector, topN }) => {
        return await outer.hyphal_object.execute('search', {
          vector,
          topN,
        });
      }),
      getDocument: protectedOp(outer, async (_, { id }) => {
        try {
          return await outer.hyphal_object.execute('getDocument', {
            id,
          });
        } catch (error) {
          return null;
        }
      }),
      searchDocuments: protectedOp(outer, async (_, { query, topN }) => {
        return await outer.hyphal_object.execute('searchDocuments', {
          query,
          topN,
        });
      }),
    },
    Mutation: {
      putVector: protectedOp(outer, async (_, { input }) => {
        const { id, namespace, content, vector } = input;
        return await outer.hyphal_object.execute('put', {
          id,
          namespace,
          content,
          vector,
        });
      }),
      deleteVector: protectedOp(outer, async (_, { ids }) => {
        return await outer.hyphal_object.execute('delete', { ids });
      }),
      deleteAllVectors: protectedOp(outer, async () => {
        return await outer.hyphal_object.execute('deleteAll', {});
      }),
      storeDocument: protectedOp(outer, async (_, { input }) => {
        const { id, namespace, content } = input;
        return await outer.hyphal_object.execute('storeDocument', {
          id,
          namespace,
          content,
        });
      }),
      deleteDocument: protectedOp(outer, async (_, { ids }) => {
        return await outer.hyphal_object.execute('deleteDocument', {
          ids,
        });
      }),
    },
  },
});

export default schema;
