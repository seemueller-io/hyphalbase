import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { expect, it, describe } from 'vitest';
import { HyphalObject } from '../src/hyphal-object';
import { SQLiteDurableObject } from '../src';

describe('Document Operations', () => {
  // Test storing and retrieving a document
  it('should store and retrieve a document', async () => {
    const id = env.SQL.idFromName('/document-test');
    const stub = env.SQL.get(id);

    // Store a document
    const documentId = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        const result = await hyphalObject.execute('storeDocument', {
          namespace: 'test-documents',
          content: 'This is a test document with some content for searching.',
        });
        return result.id;
      }
    );

    expect(documentId).toBeDefined();

    // Retrieve the document
    const document = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('getDocument', { id: documentId });
      }
    );

    expect(document).toBeDefined();
    expect(document.id).toBe(documentId);
    expect(document.namespace).toBe('test-documents');
    expect(document.content).toBe('This is a test document with some content for searching.');
  });

  // Test searching for documents
  it('should search for documents by content', async () => {
    const id = env.SQL.idFromName('/document-search-test');
    const stub = env.SQL.get(id);

    // Store multiple documents
    const documentIds = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);

        // Store three documents with different content
        const doc1 = await hyphalObject.execute('storeDocument', {
          namespace: 'test-search',
          content: 'Document about artificial intelligence and machine learning.',
        });

        const doc2 = await hyphalObject.execute('storeDocument', {
          namespace: 'test-search',
          content: 'Document about database systems and SQL queries.',
        });

        const doc3 = await hyphalObject.execute('storeDocument', {
          namespace: 'test-search',
          content: 'Document about web development and JavaScript frameworks.',
        });

        return [doc1.id, doc2.id, doc3.id];
      }
    );

    expect(documentIds.length).toBe(3);

    // Search for documents related to "machine learning"
    const searchResults1 = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('searchDocuments', {
          query: 'machine learning',
          namespace: 'test-search',
          topN: 2
        });
      }
    );

    expect(searchResults1).toBeDefined();
    expect(searchResults1.length).toBeGreaterThanOrEqual(1);
    // The first document should be the most relevant to "machine learning"
    expect(searchResults1[0].content).toContain('artificial intelligence');

    // Search for documents related to "database"
    const searchResults2 = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('searchDocuments', {
          query: 'database',
          namespace: 'test-search',
          topN: 3
        });
      }
    );


		console.log(JSON.stringify(searchResults2));

		expect(searchResults2).toBeDefined();
    expect(searchResults2.length).toBeGreaterThanOrEqual(1);
		expect(searchResults2[0].content).toContain('database systems');
  });

  // Test deleting documents
  it('should delete documents', async () => {
    const id = env.SQL.idFromName('/document-delete-test');
    const stub = env.SQL.get(id);

    // Store a document
    const documentId = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        const result = await hyphalObject.execute('storeDocument', {
          namespace: 'test-delete',
          content: 'This document will be deleted.',
        });
        return result.id;
      }
    );

    expect(documentId).toBeDefined();

    // Verify document exists
    const document = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        try {
          return await hyphalObject.execute('getDocument', { id: documentId });
        } catch (error) {
          return null;
        }
      }
    );

    expect(document).not.toBeNull();

    // Delete the document
    const deleteResult = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('deleteDocument', { ids: [documentId] });
      }
    );

    expect(deleteResult).toBeDefined();
    expect(deleteResult.message).toBe('Delete Succeeded');

    // Verify document was deleted
    const deletedDocument = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        try {
          return await hyphalObject.execute('getDocument', { id: documentId });
        } catch (error) {
          return null;
        }
      }
    );

    expect(deletedDocument).toBeNull();
  });
});
