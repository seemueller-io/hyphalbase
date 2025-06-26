import { gql } from 'graphql-request';

export const GET_DOCUMENT = gql`
  query GetDocument($id: String!) {
    getDocument(id: $id) {
      id
      namespace
      content
    }
  }
`;

export const SEARCH_DOCUMENTS = gql`
  query SearchDocuments($query: String!, $topN: Int) {
    searchDocuments(query: $query, topN: $topN) {
      id
      namespace
      content
      score
    }
  }
`;

export const STORE_DOCUMENT = gql`
  mutation StoreDocument($input: StoreDocumentInput!) {
    storeDocument(input: $input) {
      id
    }
  }
`;

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($ids: [String!]!) {
    deleteDocument(ids: $ids) {
      message
    }
  }
`;
