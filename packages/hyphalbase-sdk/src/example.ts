import { HyphalbaseClient } from './index';

// This is an example of how to use the client
async function main() {
  // Create a client
  const client = new HyphalbaseClient('https://your-hyphalbase-endpoint.com/graphql');

  try {
    // Example: Get a vector
    const vector = await client.getVector('example-id');
    console.log('Vector:', vector);

    // Example: Search vectors
    const searchResults = await client.searchVectors([0.1, 0.2, 0.3], 5);
    console.log('Search results:', searchResults);

    // Example: Put a vector
    const putResponse = await client.putVector({
      namespace: 'example-namespace',
      content: 'Example content',
      vector: [0.1, 0.2, 0.3, 0.4],
    });
    console.log('Put response:', putResponse);

    // Example: Delete a vector
    const deleteResponse = await client.deleteVector('example-id');
    console.log('Delete response:', deleteResponse);
  } catch (error) {
    console.error('Error:', error);
  }
}

// This would be executed if this file is run directly
// In ESM, there's no direct equivalent to require.main === module
// So we'll just export the main function for now

// Export the example function for testing and usage
export { main };
