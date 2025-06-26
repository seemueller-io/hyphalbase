import { gql } from 'graphql-request';

export const GET_VECTOR = gql`
	query GetVector($id: String!) {
		getVector(id: $id) {
			id
			namespace
			content
			vector
		}
	}
`;

export const SEARCH_VECTORS = gql`
	query SearchVectors($vector: [Float!]!, $topN: Int) {
		searchVectors(vector: $vector, topN: $topN) {
			id
			namespace
			content
			score
		}
	}
`;

export const PUT_VECTOR = gql`
	mutation PutVector($input: PutVectorInput!) {
		putVector(input: $input) {
			id
		}
	}
`;

export const DELETE_VECTOR = gql`
	mutation DeleteVector($ids: [String!]!) {
		deleteVector(ids: $ids) {
			message
		}
	}
`;
