import { expect, it, describe } from 'vitest';
import { chunkDocument, ChunkOpts, checkTokenLimit, chunkDocumentGenerator, Chunk } from '../src/chunker';

describe('Chunker', () => {
  // Test basic chunking with default parameters
  it('should chunk a document with default parameters', () => {
    const input = 'This is a test document. It has multiple sentences.';
    const chunks = chunkDocument(input);

    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('id', 0);
    expect(chunks[0]).toHaveProperty('text');
    expect(chunks[0]).toHaveProperty('tokenStart');
    expect(chunks[0]).toHaveProperty('tokenEnd');
  });
	//
  // // Test chunking with custom parameters
  it('should chunk a document with custom parameters', () => {
    const input = 'This is a test document. It has multiple sentences.';
    const opts: ChunkOpts = {
      chunkSize: 10,
      overlap: 2,
      boundaryRegex: /[.]/
    };

    const chunks = chunkDocument(input, opts);

    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);

    // Check that chunks have the expected properties
    chunks.forEach((chunk) => {
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('text');
      expect(chunk).toHaveProperty('tokenStart');
      expect(chunk).toHaveProperty('tokenEnd');
    });
  });
	//
  // // Test chunking with array input
  it('should chunk an array of objects with content property', () => {
    const input = [
      { content: 'First part.' },
      { content: 'Second part.' }
    ];

    const chunks = chunkDocument(input);

    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
  });
	//
  // // Test edge case: empty input
  it('should handle empty input', () => {
    const input = '';
    const chunks = chunkDocument(input);

    expect(chunks).toBeDefined();
    expect(chunks.length).toBe(0);
  });
	//
  // // Test checkTokenLimit function
  it('should check if text is within token limit', () => {
    const shortText = 'Short text';
    const longText = 'This is a longer text that might exceed a very small token limit depending on the tokenizer used.';

    // Should return token count for text within limit
    const shortResult = checkTokenLimit(shortText, 20);
    expect(typeof shortResult).toBe('number');
    expect(shortResult).toBeGreaterThan(0);

    // Should return false for text exceeding limit
    const longResult = checkTokenLimit(longText, 5);
    expect(longResult).toBe(false);
  });
	//
  // // Test chunkDocumentGenerator function
  it('should generate chunks using generator function', () => {
    const input = 'This is a test document for the generator function. It has multiple sentences to process.';
    const generator = chunkDocumentGenerator(input, { chunkSize: 10, overlap: 2 });

    // Collect chunks from generator
    const chunks: Chunk[] = [];
    for (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('id', 0);

    // Verify that chunks have the expected properties
    chunks.forEach((chunk) => {
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('text');
      expect(chunk).toHaveProperty('tokenStart');
      expect(chunk).toHaveProperty('tokenEnd');
    });
  });
});
