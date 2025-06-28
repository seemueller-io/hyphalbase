import { cosineSimilarity } from 'fast-cosine-similarity';
import { v4 as uuidv4 } from 'uuid';

import { chunkDocument, checkTokenLimit } from './chunker';
import { generateEmbedding } from './embed';
import { Gateway } from './gateway';

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
  embeddings: number[][];
}

// "Search" response items
export type ScoredRow = Partial<{
  parent_id: boolean;
  is_chunk: number;
  id: string;
  namespace: string;
  content: string;
  score: number;
}>;

export type SearchResponse = Array<ScoredRow>;

// Internal helper for simple success messages
interface OkMessage {
  message: string;
}

// Response for bulk vector insertion
export interface BulkPutResponse extends OkMessage {
  ids: string[];
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
  bulkPut: { payload: BulkPutPayload; response: BulkPutResponse };
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
  // Create namespaces table (owned by users)
  sql.exec(`
    CREATE TABLE IF NOT EXISTS namespaces(
      id TEXT PRIMARY KEY,      -- Use UUID as TEXT
      name TEXT,
      user_id TEXT,             -- Owner of this namespace
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create documents table (owned by namespaces)
  sql.exec(`
    CREATE TABLE IF NOT EXISTS documents(
      id TEXT PRIMARY KEY,      -- Use UUID as TEXT
      namespace_id TEXT,        -- Owner of this document
      content TEXT,             -- Full document content
      is_chunked INTEGER DEFAULT 0, -- 1 if document is chunked
      FOREIGN KEY(namespace_id) REFERENCES namespaces(id)
    );
  `);

  // Create content table (owned by documents)
  sql.exec(`
    CREATE TABLE IF NOT EXISTS content(
      id TEXT PRIMARY KEY,      -- Use UUID as TEXT
      document_id TEXT,         -- Owner of this content
      text TEXT,                -- Chunk of content
      is_chunk INTEGER DEFAULT 0, -- 1 if this is a chunk of a larger document
      FOREIGN KEY(document_id) REFERENCES documents(id)
    );
  `);

  // Create vectors table (owned by content)
  sql.exec(`
    CREATE TABLE IF NOT EXISTS vectors(
      id TEXT PRIMARY KEY,      -- Use UUID as TEXT
      content_id TEXT,          -- Owner of this vector
      vectors BLOB NOT NULL,    -- The actual vector data
      FOREIGN KEY(content_id) REFERENCES content(id)
    );
  `);

  // For backward compatibility, create the legacy table structure
  sql.exec(`
    CREATE TABLE IF NOT EXISTS legacy_vectors(
      id TEXT PRIMARY KEY,      -- Use UUID as TEXT
      namespace TEXT,
      vectors BLOB NOT NULL,
      content TEXT,
      parent_id TEXT,           -- ID of parent document for chunks
      is_chunk INTEGER DEFAULT 0 -- 1 if this is a chunk of a larger document
    );
  `);
}

type InsertVectorArgs = {
  id: string;
  namespace: string;
  blob: Buffer;
  content: string;
  parent_id?: string;
  is_chunk?: number;
  user_id?: string;
};

function ensureNamespace(namespace: string, user_id: string, sql: SqlStorage) {
  // Check if namespace exists, create if not
  const namespaceId = `${namespace}_${user_id}`;
  const namespaceExists = sql.exec(`SELECT id FROM namespaces WHERE id = ?`, [namespaceId]);
  const namespaceRows = [];
  for (const row of namespaceExists) {
    namespaceRows.push(row);
  }

  if (namespaceRows.length === 0) {
    sql.exec(
      `INSERT INTO namespaces (id, name, user_id) VALUES (?, ?, ?)`,
      namespaceId,
      namespace,
      user_id,
    );
  }
  return namespaceId;
}

function ensureDocument(
  parent_id: string | null,
  id: string,
  sql: SqlStorage,
  namespaceId: string,
  content: string,
  is_chunk: number,
) {
  // Create or update document
  const documentId = parent_id || id;
  sql.exec(
    `INSERT OR REPLACE INTO documents (id, namespace_id, content, is_chunked)
     VALUES (?, ?, ?, ?)`,
    documentId,
    namespaceId,
    parent_id ? '' : content, // Only store content in parent document
    parent_id ? 1 : is_chunk ? 1 : 0,
  );
  return documentId;
}

function createContentRecord(
  id: string,
  sql: SqlStorage,
  documentId: string,
  content: string,
  is_chunk: number,
) {
  const contentId = id;
  sql.exec(
    `INSERT OR REPLACE INTO content (id, document_id, text, is_chunk)
     VALUES (?, ?, ?, ?)`,
    contentId,
    documentId,
    content,
    is_chunk,
  );
  return contentId;
}

function createVectorRecord(
  sql: SqlStorage,
  id: string,
  contentId: string,
  blob: Buffer<ArrayBufferLike>,
) {
  return sql.exec(
    `INSERT OR REPLACE INTO vectors (id, content_id, vectors)
     VALUES (?, ?, ?)`,
    id,
    contentId,
    blob,
  );
}

type GetVectorArgs = { sql: SqlStorage; id: string };
function getVector(args: GetVectorArgs) {
  const { sql, id } = args;

  // First try to get from legacy_vectors for backward compatibility
  const legacyResult = sql.exec(
    `SELECT id, namespace, vectors, content, parent_id, is_chunk
     FROM legacy_vectors
     WHERE id = ?`,
    [id],
  );

  // Check if we got a result from legacy table
  let hasLegacyResult = false;
  for (const _ of legacyResult) {
    hasLegacyResult = true;
    break;
  }

  if (hasLegacyResult) {
    return legacyResult;
  }

  // If not found in legacy table, query the new schema
  // Use LEFT JOINs to ensure we get results even if some relationships are missing
  return sql.exec(
    `SELECT v.id, COALESCE(n.name, 'default') as namespace, v.vectors, COALESCE(c.text, '') as content,
            c.document_id as parent_id, COALESCE(c.is_chunk, 0) as is_chunk
     FROM vectors v
     LEFT JOIN content c ON v.content_id = c.id
     LEFT JOIN documents d ON c.document_id = d.id
     LEFT JOIN namespaces n ON d.namespace_id = n.id
     WHERE v.id = ?`,
    [id],
  );
}

type DeleteVectorArgs = { sql: SqlStorage; id: string };
function deleteVector(args: DeleteVectorArgs) {
  const { sql, id } = args;

  // First delete from legacy_vectors for backward compatibility
  sql.exec(
    `DELETE FROM legacy_vectors
     WHERE id = ?`,
    [id],
  );

  // Get content_id and document_id before deleting the vector
  const vectorInfo = sql.exec(`SELECT content_id FROM vectors WHERE id = ?`, [id]);

  let contentId = null;
  for (const row of vectorInfo) {
    contentId = row.content_id;
    break;
  }

  // Delete the vector
  sql.exec(`DELETE FROM vectors WHERE id = ?`, [id]);

  // If we found a content_id, delete the content and check if we need to clean up documents
  if (contentId) {
    // Get document_id before deleting the content
    const contentInfo = sql.exec(`SELECT document_id FROM content WHERE id = ?`, [contentId]);

    let documentId = null;
    for (const row of contentInfo) {
      documentId = row.document_id;
      break;
    }

    // Delete the content
    sql.exec(`DELETE FROM content WHERE id = ?`, [contentId]);

    // If we found a document_id, check if it has any remaining content
    if (documentId) {
      const remainingContent = sql.exec(
        `SELECT COUNT(*) as count FROM content WHERE document_id = ?`,
        [documentId],
      );

      let contentCount = 0;
      for (const row of remainingContent) {
        contentCount = row.count;
        break;
      }

      // If no content left, delete the document and check if we need to clean up namespaces
      if (contentCount === 0) {
        // Get namespace_id before deleting the document
        const query = `SELECT namespace_id FROM documents WHERE id = ?`;
        const params = [documentId];
        const documentInfo = sql.exec(query, params);

        let namespaceId = null;
        for (const row of documentInfo) {
          namespaceId = row.namespace_id;
          break;
        }

        // Delete the document
        sql.exec(`DELETE FROM documents WHERE id = ?`, [documentId]);

        // If we found a namespace_id, check if it has any remaining documents
        if (namespaceId) {
          const remainingDocuments = sql.exec(
            `SELECT COUNT(*) as count FROM documents WHERE namespace_id = ?`,
            [namespaceId],
          );

          let documentCount = 0;
          for (const row of remainingDocuments) {
            documentCount = row.count;
            break;
          }

          // If no documents left, delete the namespace
          if (documentCount === 0) {
            sql.exec(`DELETE FROM namespaces WHERE id = ?`, [namespaceId]);
          }
        }
      }
    }
  }

  return true;
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
  // First try to get from legacy_vectors for backward compatibility
  const legacyResult = sql.exec(`SELECT id, namespace, vectors, content FROM legacy_vectors`);

  // Check if we got results from legacy table
  let hasLegacyResults = false;
  for (const _ of legacyResult) {
    hasLegacyResults = true;
    break;
  }

  if (hasLegacyResults) {
    return legacyResult;
  }

  // If no legacy results, query the new schema
  // Use LEFT JOINs to ensure we get results even if some relationships are missing
  return sql.exec(`
    SELECT v.id, COALESCE(n.name, 'default') as namespace, v.vectors, COALESCE(c.text, '') as content
    FROM vectors v
    LEFT JOIN content c ON v.content_id = c.id
    LEFT JOIN documents d ON c.document_id = d.id
    LEFT JOIN namespaces n ON d.namespace_id = n.id
  `);
}

function getVectorsByNamespace(sql: SqlStorage, namespace: string) {
  // First try to get from legacy_vectors for backward compatibility
  const legacyResult = sql.exec(
    `SELECT id, namespace, vectors, content, parent_id, is_chunk
     FROM legacy_vectors
     WHERE namespace = ?`,
    namespace,
  );

  // Check if we got results from legacy table
  let hasLegacyResults = false;
  for (const _ of legacyResult) {
    hasLegacyResults = true;
    break;
  }

  if (hasLegacyResults) {
    return legacyResult;
  }

  // If no legacy results, query the new schema
  // Use LEFT JOINs to ensure we get results even if some relationships are missing
  return sql.exec(
    `
    SELECT v.id, COALESCE(n.name, 'default') as namespace, v.vectors, COALESCE(c.text, '') as content,
           c.document_id as parent_id, COALESCE(c.is_chunk, 0) as is_chunk
    FROM vectors v
    LEFT JOIN content c ON v.content_id = c.id
    LEFT JOIN documents d ON c.document_id = d.id
    LEFT JOIN namespaces n ON d.namespace_id = n.id
    WHERE n.name = ? OR (n.name IS NULL AND ? = 'default')
    `,
    namespace,
    namespace,
  );
}

function deleteAllVectors(sql: SqlStorage) {
  // Delete from legacy_vectors for backward compatibility
  sql.exec(`DELETE FROM legacy_vectors`);

  // Delete from all tables in the new schema
  sql.exec(`DELETE FROM vectors`);
  sql.exec(`DELETE FROM content`);
  sql.exec(`DELETE FROM documents`);
  sql.exec(`DELETE FROM namespaces`);

  return true;
}

export type HyphalContextType = { gateway: Gateway };

export class HyphalObject {
  constructor(
    private sql: SqlStorage,
    private gateway: Gateway,
  ) {
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

  private insertVector(args: InsertVectorArgs) {
    const {
      id,
      namespace,
      blob,
      content,
      parent_id = null,
      is_chunk = 0,
      user_id = 'default_user',
    } = args;

    const user = this.gateway.getUser();

    if (!user) {
      return { message: 'User not found' };
    }

    const namespaceId = is_chunk ? namespace : ensureNamespace(namespace, user.id, this.sql);

    const documentId = is_chunk
      ? parent_id
      : ensureDocument(parent_id, id, this.sql, namespaceId, content, is_chunk);

    const contentId = createContentRecord(id, this.sql, documentId!, content, is_chunk);

    return createVectorRecord(this.sql, id, contentId, blob);
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

        this.insertVector({
          id,
          namespace,
          blob,
          content,
        });

        return { id };
      }
      case 'get': {
        const { id } = payload as GetPayload;

        // First try to get from legacy_vectors for backward compatibility
        const legacyResult = this.sql.exec(
          `SELECT id, namespace, vectors, content
           FROM legacy_vectors
           WHERE id = ?`,
          [id],
        );

        // Check if we got a result from legacy table
        let row = null;
        for (const r of legacyResult) {
          row = r;
          break;
        }

        // If not found in legacy table, try the new schema
        if (!row) {
          const newSchemaResult = this.sql.exec(
            `SELECT v.id, COALESCE(n.name, 'default') as namespace, v.vectors, COALESCE(c.text, '') as content
             FROM vectors v
             LEFT JOIN content c ON v.content_id = c.id
             LEFT JOIN documents d ON c.document_id = d.id
             LEFT JOIN namespaces n ON d.namespace_id = n.id
             WHERE v.id = ?`,
            [id],
          );

          for (const r of newSchemaResult) {
            row = r;
            break;
          }
        }

        if (!row) {
          throw 'Vector not found';
        }

        if (!row.vectors) {
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

        const embeddings = await HyphalObject.embed([content]);

        return <EmbedResponse>{
          embeddings: embeddings.map(embedding => embedding.embedding),
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
          vectors: processedVectors,
        });

        // Return the IDs of the inserted vectors
        const ids = processedVectors.map(vector => vector.id);
        return { message: 'Bulk insert succeeded', ids };
      }

      case 'deleteAll': {
        deleteAllVectors(this.sql);

        return { message: 'All vectors deleted successfully' };
      }

      case 'storeDocument': {
        const { id: rxId, namespace, content } = payload as StoreDocumentPayload;

        const user = this.gateway.getUser();

        const id: string = rxId ?? uuidv4();

        // Check if the document exceeds the token limit (8000 tokens)
        const TOKEN_LIMIT = 8000;
        const tokenCount = checkTokenLimit(content, TOKEN_LIMIT);

        // If the document is within the token limit, store it as a single vector
        if (tokenCount !== false) {
          // Generate embedding for the document content
          const vector = (await HyphalObject.embed([content])).at(0)!.embedding!;

          const blob = Buffer.from(this.encodeVectorToBlob(vector));

          // Store the document as a vector
          this.insertVector({
            id,
            namespace,
            blob,
            content,
            user_id: user?.id,
          });

          return { id };
        } else {
          // Chunk the document
          const chunks = chunkDocument(content, {
            chunkSize: Math.floor(TOKEN_LIMIT * 0.8), // 80% of token limit for safety
            overlap: Math.floor(TOKEN_LIMIT * 0.1), // 10% overlap
          });

          // Store metadata about the full document
          this.insertVector({
            id,
            namespace,
            blob: Buffer.from(new Uint8Array(0)), // Empty vector for the parent
            content, // Store the full content in the parent
            is_chunk: 0, // This is the parent document
          });

          const texts = chunks.map(chunk => chunk.text);
          const vectors = await HyphalObject.embed(texts);
          // Store each chunk with a reference to the parent document
          const blob_chunks = chunks.map(async (chunk, index) => {
            // Make sure we have a valid vector for this chunk
            if (!vectors[index] || !vectors[index].embedding) {
              console.log(`Missing embedding for chunk ${index}`);
              // Return a placeholder with an empty vector
              return {
                id: crypto.randomUUID(),
                namespace,
                content: chunk.text,
                parent_id: id,
                is_chunk: 1,
                blob: Buffer.from(new Uint8Array(0)),
              };
            }

            return {
              id: crypto.randomUUID(),
              namespace,
              content: chunk.text,
              parent_id: id,
              is_chunk: 1,
              blob: Buffer.from(this.encodeVectorToBlob(vectors[index].embedding)),
            };
          });

          this.bulkInsertVectors({
            vectors: await Promise.all(blob_chunks),
          });

          return { id };
        }
      }

      case 'getDocument': {
        const { id } = payload as GetPayload;

        // First try to get from legacy_vectors for backward compatibility
        const legacyResult = this.sql.exec(
          `SELECT id, namespace, content
           FROM legacy_vectors
           WHERE id = ?`,
          [id],
        );

        // Check if we got a result from legacy table
        let document = null;
        for (const row of legacyResult) {
          document = {
            id: row.id,
            namespace: row.namespace,
            content: row.content,
          };
          break;
        }

        // If not found in legacy table, try the new schema
        if (!document) {
          const newSchemaResult = this.sql.exec(
            `SELECT d.id, COALESCE(n.name, 'default') as namespace, COALESCE(d.content, '') as content
             FROM documents d
             LEFT JOIN namespaces n ON d.namespace_id = n.id
             WHERE d.id = ?`,
            [id],
          );

          for (const row of newSchemaResult) {
            document = {
              id: row.id,
              namespace: row.namespace,
              content: row.content,
            };
            break;
          }
        }

        // If still not found, try to get from vectors/content tables
        if (!document) {
          const vectorResult = this.sql.exec(
            `SELECT v.id, COALESCE(n.name, 'default') as namespace, COALESCE(c.text, '') as content
             FROM vectors v
             LEFT JOIN content c ON v.content_id = c.id
             LEFT JOIN documents d ON c.document_id = d.id
             LEFT JOIN namespaces n ON d.namespace_id = n.id
             WHERE v.id = ?`,
            [id],
          );

          for (const row of vectorResult) {
            document = {
              id: row.id,
              namespace: row.namespace,
              content: row.content,
            };
            break;
          }
        }

        if (!document) {
          throw 'Document not found';
        }

        return document as DocumentResponse;
      }

      case 'searchDocuments': {
        const { query, namespace, topN } = payload as SearchDocumentsPayload;

        // Generate embedding for the search query
        const queryVector = (await HyphalObject.embed([query])).at(0)!.embedding!;

        // Get all vectors in the namespace
        const rows = getVectorsByNamespace(this.sql, namespace);

        const rowsArray = rows.toArray();
        // console.log(rows);
        // console.log('found rows:', rowsArray.length);
        // Score all rows based on similarity to the query
        // console.log(queryVector);
        const scoredRows = await this.scoreRows(rowsArray, queryVector);
        // console.log({ scoredRows });
        // Process results to handle chunked documents
        const processedResults = await this.processSearchResults(scoredRows);

        // Sort by score (highest first)
        const sortedResults = processedResults.sort((a, b) => b.score! - a.score!);

        // Return top N results
        const topResults = topN ? sortedResults.slice(0, topN) : sortedResults;

        return topResults;
      }

      case 'deleteDocument': {
        const { ids } = payload as DeletePayload;

        try {
          // For each document ID
          for (const id of ids) {
            // First, find and delete all chunks associated with this document from legacy table
            const legacyChunksCursor = this.sql.exec(
              `SELECT id FROM legacy_vectors WHERE parent_id = ?`,
              [id],
            );

            const legacyChunkIds = [];
            for (const row of legacyChunksCursor) {
              legacyChunkIds.push(row.id);
            }

            // Delete all legacy chunks associated with this document
            if (legacyChunkIds.length > 0) {
              bulkDeleteVectors({
                ids: legacyChunkIds,
                sql: this.sql,
              });
            }

            // Find and delete all chunks associated with this document from new schema
            const contentChunksCursor = this.sql.exec(
              `SELECT c.id FROM content c WHERE c.document_id = ? AND c.is_chunk = 1`,
              [id],
            );

            const contentChunkIds = [];
            for (const row of contentChunksCursor) {
              contentChunkIds.push(row.id);
            }

            // Delete all content chunks associated with this document
            if (contentChunkIds.length > 0) {
              for (const chunkId of contentChunkIds) {
                // Delete the vector associated with this chunk
                this.sql.exec(`DELETE FROM vectors WHERE content_id = ?`, [chunkId]);
                // Delete the chunk itself
                this.sql.exec(`DELETE FROM content WHERE id = ?`, [chunkId]);
              }
            }

            // Delete from legacy_vectors
            this.sql.exec(`DELETE FROM legacy_vectors WHERE id = ?`, [id]);

            // Delete from new schema
            // First get the namespace_id from documents
            const documentQuery = this.sql.exec(`SELECT namespace_id FROM documents WHERE id = ?`, [
              id,
            ]);

            let namespaceId = null;
            for (const row of documentQuery) {
              namespaceId = row.namespace_id;
              break;
            }

            // Delete the vector associated with this document
            this.sql.exec(`DELETE FROM vectors WHERE id = ?`, [id]);

            // Delete the content associated with this document
            this.sql.exec(`DELETE FROM content WHERE id = ?`, [id]);

            // Delete the document itself
            this.sql.exec(`DELETE FROM documents WHERE id = ?`, [id]);

            // If we found a namespace_id, check if it has any remaining documents
            if (namespaceId) {
              const remainingDocuments = this.sql.exec(
                `SELECT COUNT(*) as count FROM documents WHERE namespace_id = ?`,
                [namespaceId],
              );

              let documentCount = 0;
              for (const row of remainingDocuments) {
                documentCount = row.count;
                break;
              }

              // If no documents left, delete the namespace
              if (documentCount === 0) {
                this.sql.exec(`DELETE FROM namespaces WHERE id = ?`, [namespaceId]);
              }
            }
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
    rows: Array<Record<string, SqlStorageValue>>,
    embeddedQuery: number[],
  ): Promise<SearchResponse> {
    // Convert cursor to array
    // console.log('Rows length', rows.length);
    // console.log('Row keys', Object.keys(rows.at(0) ?? {}));
    return rows
      .map(row => ({
        row,
        vectors: row.vectors ? HyphalObject.decodeRowToVector(row) : [],
      }))
      .map(({ row, vectors }) => {
        // Handle both legacy and new schema formats
        // console.log('score', HyphalObject.cosineSimilarity(embeddedQuery, vectors));
        return {
          id: row.id,
          namespace: row.namespace,
          content: row.content || row.text, // Handle both content and text fields
          parent_id: row.parent_id || row.document_id, // Handle both parent_id and document_id fields
          is_chunk: row.is_chunk !== undefined ? row.is_chunk : 0,
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
            // First try to get from legacy table
            let parentDoc: DocumentResponse | null = null;

            try {
              parentDoc = (await this.execute('getDocument', {
                id: parentId,
              })) as DocumentResponse;
            } catch (error) {
              // If not found in legacy table, try the new schema
              const documentQuery = this.sql.exec(
                `SELECT d.id, COALESCE(n.name, 'default') as namespace, COALESCE(d.content, '') as content
                 FROM documents d
                 LEFT JOIN namespaces n ON d.namespace_id = n.id
                 WHERE d.id = ?`,
                [parentId],
              );

              for (const docRow of documentQuery) {
                parentDoc = {
                  id: docRow.id,
                  namespace: docRow.namespace,
                  content: docRow.content,
                };
                break;
              }
            }

            if (parentDoc) {
              // Store the parent document with the chunk's score
              documentScores.set(parentId, row.score);
              documentData.set(parentId, {
                id: parentId,
                namespace: parentDoc.namespace,
                content: parentDoc.content,
                score: row.score,
              });
            } else {
              // If parent document not found, use the chunk as a standalone document
              documentScores.set(row.id, row.score);
              documentData.set(row.id, row);
            }
          } catch (error) {
            // Error handled without logging sensitive information
            // If there's an error, use the chunk as a standalone document
            documentScores.set(row.id, row.score);
            documentData.set(row.id, row);
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

  private bulkInsertVectors(args: { vectors: VectorsType }) {
    const { vectors } = args;

    // Insert each vector individually
    // Durable Objects automatically coalesce writes into atomic transactions
    for (const vector of vectors) {
      // Use insertVector function which handles both legacy and new schema
      this.insertVector({
        id: vector.id,
        namespace: vector.namespace,
        blob: vector.blob,
        content: vector.content,
        parent_id: vector.parent_id,
        is_chunk: vector.is_chunk,
      });
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

  static cosineSimilarity(vecA: any[], vecB: any[]): number {
    // console.log({ vecA });
    try {
      return cosineSimilarity(vecA, vecB);
    } catch (error) {
      console.log('skipping 0 size vectors');
      return 0;
    }

    // const vectorA = new Float32Array(vecA.length);
    // const vectorB = new Float32Array(vecB.length);
    //
    // vectorA.set(vecA);
    // vectorB.set(vecB);
    //
    // const distance = cosine(vectorA, vectorB);
    // console.log('Cosine Distance:', distance);
    // return distance;
    // let dotProduct = 0;
    // let magnitudeA = 0;
    // let magnitudeB = 0;
    //
    // for (let i = 0; i < vecA.length; i++) {
    //   dotProduct += vecA[i] * vecB[i];
    //   magnitudeA += vecA[i] ** 2;
    //   magnitudeB += vecB[i] ** 2;
    // }
    //
    // magnitudeA = Math.sqrt(magnitudeA);
    // magnitudeB = Math.sqrt(magnitudeB);
    //
    // if (magnitudeA === 0 || magnitudeB === 0) {
    //   return 0;
    // }
    //
    // return dotProduct / (magnitudeA * magnitudeB);
  }
}

export type VectorsType = Array<{
  id: string;
  namespace: string;
  blob: Buffer;
  content: string;
  parent_id?: string;
  is_chunk?: number;
}>;
