import { gql } from 'graphql-request';

export const EMBED = gql`
  query Embed($content: String!) {
    embed(content: $content) {
      embeddings
    }
  }
`;

export const DELETE_ALL_VECTORS = gql`
  mutation DeleteAllVectors {
    deleteAllVectors {
      message
    }
  }
`;
