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
  // Test storing and retrieving a very large document
  it('should store and retrieve a very large document', async () => {
    const id = env.SQL.idFromName('/large-document-test');
    const stub = env.SQL.get(id);

    // Create a very large document that exceeds the token limit (8000 tokens)
    // This is approximately 32,000 words or about 60 pages of text
    let largeContent = '';
    const paragraph = 'This is a test paragraph with enough words to help us generate a very large document. We need to exceed the token limit to test chunking. ';
    // Generate about 10,000 tokens worth of content
    for (let i = 0; i < 1000; i++) {
      largeContent += paragraph + `This is paragraph number ${i}. `;
    }

    console.log(`[DEBUG_LOG] Created large document with length: ${largeContent.length} characters`);

    // Store the large document
    const documentId = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        const result = await hyphalObject.execute('storeDocument', {
          namespace: 'test-large-documents',
          content: largeContent,
        });
        return result.id;
      }
    );

    expect(documentId).toBeDefined();
    console.log(`[DEBUG_LOG] Stored large document with ID: ${documentId}`);

    // Retrieve the large document
    const document = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('getDocument', { id: documentId });
      }
    );

    expect(document).toBeDefined();
    expect(document.id).toBe(documentId);
    expect(document.namespace).toBe('test-large-documents');
    expect(document.content).toBe(largeContent);
    console.log(`[DEBUG_LOG] Retrieved large document with length: ${document.content.length} characters`);

    // Search for content within the large document
    const searchResults = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('searchDocuments', {
          query: 'paragraph number 500',
          namespace: 'test-large-documents',
          topN: 1
        });
      }
    );

    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe(documentId);
    console.log(`[DEBUG_LOG] Successfully searched within large document`);

    // Delete the large document
    const deleteResult = await runInDurableObject(
      stub,
      async (instance: SQLiteDurableObject) => {
        const hyphalObject = new HyphalObject(instance.ctx.storage.sql);
        return await hyphalObject.execute('deleteDocument', { ids: [documentId] });
      }
    );

    expect(deleteResult).toBeDefined();
    expect(deleteResult.message).toBe('Delete Succeeded');
    console.log(`[DEBUG_LOG] Successfully deleted large document`);

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
