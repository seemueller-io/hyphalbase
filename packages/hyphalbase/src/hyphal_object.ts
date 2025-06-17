import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding } from './embed';

export interface PutVectorInput {
	/** Optional UUID; server autogenerates if omitted */
	id?: string;
	namespace: string;
	content: string;
}

export interface PutVectorResponse {
	id: string;
}

// "Get" response (same for single-vector fetch)
export interface GetVectorResponse {
	id: string;
	namespace: string;
	vector: number[];
	content: string;
}

// "Get" response (same for single-vector fetch)
export interface EmbedResponse {
	embeddings: number[];
}

// "Search" response items
export interface ScoredRow {
	id: string;
	namespace: string;
	content: string;
	score: number;
}

export interface SearchResponse extends Array<ScoredRow> {}

// Internal helper for simple success messages
interface OkMessage {
	message: string;
}

////////////////////////
// Operation mappings //
////////////////////////
interface EmbedPayload {
	content: string;
}

// --- Payload shapes ---
interface PutPayload extends PutVectorInput {
	vector: number[];
}

interface GetPayload {
	id: string;
}

interface DeletePayload {
	id: string;
}

interface SearchPayload {
	vector: number[];
	topN?: number;
}

type DeleteAllPayload = Record<string, never>; // no payload

/**
 * Maps each operation to its payload and response types.
 * Used by the generic `request` method for end‑to‑end type‑safety.
 */
interface OperationMap {
	put: { payload: PutPayload; response: PutVectorResponse };
	get: { payload: GetPayload; response: GetVectorResponse };
	embed: { payload: EmbedPayload; response: EmbedResponse };
	delete: { payload: DeletePayload; response: OkMessage };
	search: { payload: SearchPayload; response: ScoredRow[] };
	deleteAll: { payload: DeleteAllPayload; response: OkMessage };
}

function createTable(sql: SqlStorage) {
	return sql.exec(`
			CREATE TABLE IF NOT EXISTS vectors(
				id TEXT PRIMARY KEY,			 -- Use UUID as TEXT
				namespace TEXT,
				vectors BLOB NOT NULL,
				content TEXT
			);
		`);
}

type InsertVectorArgs = {
	sql: SqlStorage;
	id: string;
	namespace: string;
	blob: Buffer;
	content: string;
};
function insertVector(args: InsertVectorArgs) {
	const { sql, id, namespace, blob, content } = args;
	return sql.exec(
		`INSERT
		OR REPLACE INTO vectors (id, namespace, vectors, content) VALUES (?, ?, ?, ?)`,
		id,
		namespace,
		blob,
		content
	);
}
type GetVectorArgs = { sql: SqlStorage; id: string };
function getVector(args: GetVectorArgs) {
	const { sql, id } = args;
	return sql.exec(
		`SELECT id, namespace, vectors, content
		 FROM vectors
		 WHERE id = ?`,
		[id]
	);
}

type DeleteVectorArgs = { sql: SqlStorage; id: string };
function deleteVector(args: DeleteVectorArgs) {
	const { sql, id } = args;
	return sql.exec(
		`DELETE
									 FROM vectors
									 WHERE id = ?`,
		[id]
	);
}

function getAllVectors(sql: SqlStorage) {
	return sql.exec(
		`SELECT id, namespace, vectors, content
		 FROM vectors`
	);
}

function deleteAllVectors(sql: SqlStorage) {
	return sql.exec(`DELETE
									 FROM vectors`);
}

export class HyphalObject {
	constructor(private sql: SqlStorage) {
		if(sql) {
			createTable(sql);
		}
	}

	private async query<Op extends keyof OperationMap>(
		operation: Op,
		payload: OperationMap[Op]['payload']
	): Promise<OperationMap[Op]['response']> {
		return this.execute(operation, payload);
	}

	async execute<Op extends keyof OperationMap>(
		operation: Op,
		payload: OperationMap[keyof OperationMap]['payload']
	): Promise<OperationMap[Op]['response']> {
		switch (operation) {
			case 'put': {
				let { id, namespace, vector, content } = payload as PutPayload;

				if (!id) {
					id = uuidv4();
				}

				const blob = Buffer.from(this.encodeVectorToBlob(vector));

				insertVector({
					id,
					namespace,
					blob,
					content,
					sql: this.sql,
				});

				return { id };
			}
			case 'get': {
				const { id } = payload as GetPayload;

				const cursor = getVector({
					id: id,
					sql: this.sql,
				});

				const results = [];
				for (const row of cursor) {
					results.push(row);
				}

				if (results.length === 0) {
					throw 'Vector not found';
				}

				const row = results[0];
				if (!row || !row.vectors) {
					throw 'Vector data is corrupted or missing';
				}

				let vector;
				try {
					// @ts-ignore - not assignable
					vector = HyphalObject.decodeBlobToVector(row.vectors);
				} catch (error: any) {
					throw `Error decoding vector: ${error.message}`;
				}

				return <GetVectorResponse>{
					id: row.id,
					namespace: row.namespace,
					vector: vector,
					content: row.content,
				};
			}

			case 'delete': {
				const { id } = payload as DeletePayload;

				try {
					deleteVector({
						id,
						sql: this.sql,
					});
					return { message: 'Delete Succeeded' };
				} catch (error) {
					return { message: 'Delete Failed' };
				}
			}

			case 'embed': {
				const { content } = payload as EmbedPayload;

				const embeddings = await HyphalObject.embed(content);

				return <EmbedResponse>{
					embeddings,
				};
			}

			case 'search': {
				const { vector: query, topN } = payload as SearchPayload;

				const rows = getAllVectors(this.sql);

				const scoredRows = await this.scoreRows(rows, query);

				const topResults = topN
					? scoredRows.slice(0, topN)
					: scoredRows;

				return topResults;
			}

			case 'deleteAll': {
				deleteAllVectors(this.sql);

				return { message: 'All vectors deleted successfully' };
			}

			default:
				return { message: 'Invalid operation' };
		}
	}

	private async scoreRows(
		rows: SqlStorageCursor<Record<string, SqlStorageValue>>,
		embeddedQuery: number[]
	): Promise<SearchResponse> {
		return rows
		// @ts-ignore - map is valid
			.map(row => ({
				row,
				vectors: HyphalObject.decodeRowToVector(row),
			}))
			.map(({ row, vectors }) => {
				return {
					id: row.id,
					namespace: row.namespace,
					content: row.content,
					score: HyphalObject.cosineSimilarity(
						embeddedQuery,
						vectors
					),
				};
			})
			.sort(this.sort);
	}

	private sort(prev: { score: number }, next: { score: number }) {
		return prev.score - next.score;
	}

	encodeVectorToBlob(vector: number[]): Uint8Array {
		const buffer = new ArrayBuffer(
			vector.length * Float32Array.BYTES_PER_ELEMENT
		);
		const view = new Float32Array(buffer);
		for (let i = 0; i < vector.length; i++) {
			view[i] = vector[i];
		}
		return new Uint8Array(buffer);
	}

	static decodeBlobToVector(blob: ArrayBuffer | Uint8Array): number[] {
		if (blob instanceof ArrayBuffer) {
			blob = new Uint8Array(blob);
		}

		if (!(blob instanceof Uint8Array)) {
			throw new TypeError('Invalid blob data for decoding.');
		}

		const buffer = blob.buffer.slice(
			blob.byteOffset,
			blob.byteOffset + blob.byteLength
		);
		const view = new Float32Array(buffer);
		return Array.from(view);
	}

	static decodeRowToVector(row): number[] {
		try {
			const { vectors } = row;
			return HyphalObject.decodeBlobToVector(vectors);
		} catch (error) {
			throw 'Failed to decode row to vector\n' + error;
		}
	}

	static embed = generateEmbedding;

	static cosineSimilarity(vecA: number[], vecB: number[]): number {
		let dotProduct = 0;
		let magnitudeA = 0;
		let magnitudeB = 0;

		for (let i = 0; i < vecA.length; i++) {
			dotProduct += vecA[i] * vecB[i];
			magnitudeA += vecA[i] ** 2;
			magnitudeB += vecB[i] ** 2;
		}

		magnitudeA = Math.sqrt(magnitudeA);
		magnitudeB = Math.sqrt(magnitudeB);

		if (magnitudeA === 0 || magnitudeB === 0) {
			return 0;
		}

		return dotProduct / (magnitudeA * magnitudeB);
	}
}
