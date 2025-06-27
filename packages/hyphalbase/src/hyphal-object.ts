import { v4 as uuidv4 } from 'uuid';

import { chunkDocument, checkTokenLimit } from './chunker';
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

// Document response
export interface DocumentResponse {
  id: string;
  namespace: string;
  content: string;
}

// Store document response
export interface StoreDocumentResponse {
  id: string;
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

export type SearchResponse = Array<ScoredRow>;

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

interface StoreDocumentPayload {
  id?: string;
  namespace: string;
  content: string;
}

interface BulkPutPayload {
  vectors: Array<{
    id?: string;
    namespace: string;
    vector: number[];
    content: string;
  }>;
}

interface GetPayload {
  id: string;
}

interface DeletePayload {
  ids: string[];
}

interface SearchPayload {
  vector: number[];
  topN?: number;
}

interface SearchDocumentsPayload {
  query: string;
  namespace: string;
  topN?: number;
}

type DeleteAllPayload = Record<string, never>; // no payload

/**
 * Maps each operation to its payload and response types.
 * Used by the generic `request` method for end‑to‑end type‑safety.
 */
interface OperationMap {
  put: { payload: PutPayload; response: PutVectorResponse };
  bulkPut: { payload: BulkPutPayload; response: OkMessage };
  get: { payload: GetPayload; response: GetVectorResponse };
  embed: { payload: EmbedPayload; response: EmbedResponse };
  delete: { payload: DeletePayload; response: OkMessage };
  search: { payload: SearchPayload; response: ScoredRow[] };
  deleteAll: { payload: DeleteAllPayload; response: OkMessage };
  storeDocument: {
    payload: StoreDocumentPayload;
    response: StoreDocumentResponse;
  };
  getDocument: { payload: GetPayload; response: DocumentResponse };
  searchDocuments: { payload: SearchDocumentsPayload; response: ScoredRow[] };
  deleteDocument: { payload: DeletePayload; response: OkMessage };
}

function createTable(sql: SqlStorage) {
  return sql.exec(`
			CREATE TABLE IF NOT EXISTS vectors(
				id TEXT PRIMARY KEY,			 -- Use UUID as TEXT
				namespace TEXT,
				vectors BLOB NOT NULL,
				content TEXT,
				parent_id TEXT,                  -- ID of parent document for chunks
				is_chunk INTEGER DEFAULT 0       -- 1 if this is a chunk of a larger document
			);
		`);
}

type InsertVectorArgs = {
  sql: SqlStorage;
  id: string;
  namespace: string;
  blob: Buffer;
  content: string;
  parent_id?: string;
  is_chunk?: number;
};
function insertVector(args: InsertVectorArgs) {
  const { sql, id, namespace, blob, content, parent_id = null, is_chunk = 0 } = args;
  return sql.exec(
    `INSERT
		OR REPLACE INTO vectors (id, namespace, vectors, content, parent_id, is_chunk) VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    namespace,
    blob,
    content,
    parent_id,
    is_chunk,
  );
}
type GetVectorArgs = { sql: SqlStorage; id: string };
function getVector(args: GetVectorArgs) {
  const { sql, id } = args;
  return sql.exec(
    `SELECT id, namespace, vectors, content
		 FROM vectors
		 WHERE id = ?`,
    [id],
  );
}

type DeleteVectorArgs = { sql: SqlStorage; id: string };
function deleteVector(args: DeleteVectorArgs) {
  const { sql, id } = args;
  return sql.exec(
    `DELETE
									 FROM vectors
									 WHERE id = ?`,
    [id],
  );
}

type BulkDeleteVectorsArgs = { sql: SqlStorage; ids: string[] };
function bulkDeleteVectors(args: BulkDeleteVectorsArgs) {
  const { sql, ids } = args;

  // Delete each vector individually
  // Durable Objects automatically coalesce writes into atomic transactions
  for (const id of ids) {
    deleteVector({
      id,
      sql,
    });
  }
}

function getAllVectors(sql: SqlStorage) {
  return sql.exec(
    `SELECT id, namespace, vectors, content
		 FROM vectors`,
  );
}

function getVectorsByNamespace(sql: SqlStorage, namespace: string) {
  return sql.exec(
    `SELECT id, namespace, vectors, content, parent_id, is_chunk
		 FROM vectors
		 WHERE namespace = ?`,
    namespace,
  );
}

function deleteAllVectors(sql: SqlStorage) {
  return sql.exec(`DELETE
									 FROM vectors`);
}

export class HyphalObject {
  constructor(private sql: SqlStorage) {
    if (sql) {
      createTable(sql);
    }
  }

  private async query<Op extends keyof OperationMap>(
    operation: Op,
    payload: OperationMap[Op]['payload'],
  ): Promise<OperationMap[Op]['response']> {
    return this.execute(operation, payload);
  }

  async execute<Op extends keyof OperationMap>(
    operation: Op,
    payload: OperationMap[keyof OperationMap]['payload'],
  ): Promise<OperationMap[Op]['response']> {
    switch (operation) {
      case 'put': {
        const { id: rxId, namespace, vector, content } = payload as PutPayload;

        const id: string = rxId ?? uuidv4();

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
          // @ts-expect-error - not assignable
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
        const { ids } = payload as DeletePayload;

        try {
          bulkDeleteVectors({
            ids,
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

        const topResults = topN ? scoredRows.slice(0, topN) : scoredRows;

        return topResults;
      }

      case 'bulkPut': {
        const { vectors } = payload as BulkPutPayload;

        // Process each vector to ensure it has an ID and convert to the format expected by bulkInsertVectors
        const processedVectors = vectors.map(vector => {
          const id = vector.id || uuidv4();
          const blob = Buffer.from(this.encodeVectorToBlob(vector.vector));

          return {
            id,
            namespace: vector.namespace,
            blob,
            content: vector.content,
          };
        });

        // Insert all vectors in a single transaction
        this.bulkInsertVectors({
          sql: this.sql,
          vectors: processedVectors,
        });

        return { message: 'Bulk insert succeeded' };
      }

      case 'deleteAll': {
        deleteAllVectors(this.sql);

        return { message: 'All vectors deleted successfully' };
      }

      case 'storeDocument': {
        const { id: rxId, namespace, content } = payload as StoreDocumentPayload;

        const id: string = rxId ?? uuidv4();

        // Check if the document exceeds the token limit (8000 tokens)
        const TOKEN_LIMIT = 8000;
        const tokenCount = checkTokenLimit(content, TOKEN_LIMIT);

        // If the document is within the token limit, store it as a single vector
        if (tokenCount !== false) {
          // Generate embedding for the document content
          const vector = await HyphalObject.embed(content);
          const blob = Buffer.from(this.encodeVectorToBlob(vector));

          // Store the document as a vector
          insertVector({
            id,
            namespace,
            blob,
            content,
            sql: this.sql,
          });

          return { id };
        } else {
          // Chunk the document
          const chunks = chunkDocument(content, {
            chunkSize: Math.floor(TOKEN_LIMIT * 0.8), // 80% of token limit for safety
            overlap: Math.floor(TOKEN_LIMIT * 0.1), // 10% overlap
          });

          // Store metadata about the full document
          insertVector({
            id,
            namespace,
            blob: Buffer.from(new Uint8Array(0)), // Empty vector for the parent
            content, // Store the full content in the parent
            sql: this.sql,
            is_chunk: 0, // This is the parent document
          });

          // Store each chunk with a reference to the parent document
          for (const chunk of chunks) {
            const chunkId = uuidv4();

            // Generate embedding for the chunk content
            const vector = await HyphalObject.embed(chunk.text);
            const blob = Buffer.from(this.encodeVectorToBlob(vector));

            // Store the chunk as a vector with reference to parent
            insertVector({
              id: chunkId,
              namespace,
              blob,
              content: chunk.text,
              parent_id: id,
              is_chunk: 1,
              sql: this.sql,
            });
          }

          return { id };
        }
      }

      case 'getDocument': {
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
          throw 'Document not found';
        }

        const row = results[0];
        if (!row) {
          throw 'Document data is corrupted or missing';
        }

        // Note: For chunked documents, is_chunk will be 0 for parent documents
        // and the vectors field will be empty (byteLength === 0)

        return <DocumentResponse>{
          id: row.id,
          namespace: row.namespace,
          content: row.content,
        };
      }

      case 'searchDocuments': {
        const { query, namespace, topN } = payload as SearchDocumentsPayload;

        // Generate embedding for the search query
        const queryVector = await HyphalObject.embed(query);

        // Get all vectors in the namespace
        const rows = getVectorsByNamespace(this.sql, namespace);

        // Score all rows based on similarity to the query
        const scoredRows = await this.scoreRows(rows, queryVector);

        // Process results to handle chunked documents
        const processedResults = await this.processSearchResults(scoredRows);

        // Sort by score (highest first)
        const sortedResults = processedResults.sort((a, b) => b.score - a.score);

        // Return top N results
        const topResults = topN ? sortedResults.slice(0, topN) : sortedResults;

        return topResults;
      }

      case 'deleteDocument': {
        const { ids } = payload as DeletePayload;

        try {
          // For each document ID
          for (const id of ids) {
            // First, find and delete all chunks associated with this document
            const chunksCursor = this.sql.exec(`SELECT id FROM vectors WHERE parent_id = ?`, [id]);

            const chunkIds = [];
            for (const row of chunksCursor) {
              chunkIds.push(row.id);
            }

            // Delete all chunks associated with this document
            if (chunkIds.length > 0) {
              bulkDeleteVectors({
                ids: chunkIds,
                sql: this.sql,
              });
            }

            // Then delete the document itself
            deleteVector({
              id,
              sql: this.sql,
            });
          }

          return { message: 'Delete Succeeded' };
        } catch (error) {
          // Error handled without logging sensitive information
          return { message: 'Delete Failed' };
        }
      }

      default:
        return { message: 'Invalid operation' };
    }
  }

  private async scoreRows(
    rows: SqlStorageCursor<Record<string, SqlStorageValue>>,
    embeddedQuery: number[],
  ): Promise<SearchResponse> {
    // Convert cursor to array
    const rowsArray = [];
    for (const row of rows) {
      rowsArray.push(row);
    }

    return rowsArray
      .map(row => ({
        row,
        vectors:
          row.vectors && row.vectors.byteLength > 0 ? HyphalObject.decodeRowToVector(row) : [],
      }))
      .map(({ row, vectors }) => {
        return {
          id: row.id,
          namespace: row.namespace,
          content: row.content,
          parent_id: row.parent_id,
          is_chunk: row.is_chunk,
          score: vectors.length > 0 ? HyphalObject.cosineSimilarity(embeddedQuery, vectors) : 0,
        };
      })
      .sort(this.sort);
  }

  /**
   * Process search results to handle chunked documents
   * @param scoredRows The scored rows from the search
   * @returns Processed search results with parent documents for chunks
   */
  private async processSearchResults(scoredRows: SearchResponse): Promise<SearchResponse> {
    // Map to store the highest score for each document ID
    const documentScores = new Map<string, number>();
    // Map to store the document data for each ID
    const documentData = new Map<string, ScoredRow>();

    // Process each row
    for (const row of scoredRows) {
      // Skip rows with zero score (like parent documents with empty vectors)
      if (row.score === 0) continue;

      // If this is a chunk, we need to get its parent document
      if (row.is_chunk === 1 && row.parent_id) {
        const parentId = row.parent_id;

        // If we haven't seen this parent before, or this chunk has a higher score
        if (!documentScores.has(parentId) || row.score > documentScores.get(parentId)!) {
          // Get the parent document
          try {
            const parentDoc = (await this.execute('getDocument', {
              id: parentId,
            })) as DocumentResponse;

            // Store the parent document with the chunk's score
            documentScores.set(parentId, row.score);
            documentData.set(parentId, {
              id: parentId,
              namespace: parentDoc.namespace,
              content: parentDoc.content,
              score: row.score,
            });
          } catch (error) {
            // Error handled without logging sensitive information
          }
        }
      } else {
        // This is a regular document, store it directly
        documentScores.set(row.id, row.score);
        documentData.set(row.id, row);
      }
    }

    return Array.from(documentData.values());
  }

  /**
   * Comparison function used for sorting search results by similarity scores.
   * Returns positive values when the next score is higher than the previous score,
   * which sorts results in descending order (highest scores first).
   */
  private sort(prev: { score: number }, next: { score: number }) {
    return next.score - prev.score;
  }

  private bulkInsertVectors(args: {
    sql: SqlStorage;
    vectors: Array<{
      id: string;
      namespace: string;
      blob: Buffer;
      content: string;
      parent_id?: string;
      is_chunk?: number;
    }>;
  }) {
    const { sql, vectors } = args;

    // Insert each vector individually
    // Durable Objects automatically coalesce writes into atomic transactions
    for (const vector of vectors) {
      sql.exec(
        `INSERT OR REPLACE INTO vectors (id, namespace, vectors, content, parent_id, is_chunk) VALUES (?, ?, ?, ?, ?, ?)`,
        vector.id,
        vector.namespace,
        vector.blob,
        vector.content,
        vector.parent_id || null,
        vector.is_chunk || 0,
      );
    }
  }

  encodeVectorToBlob(vector: number[]): Uint8Array {
    const buffer = new ArrayBuffer(vector.length * Float32Array.BYTES_PER_ELEMENT);
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

    const buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
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
