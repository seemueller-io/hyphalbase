# HyphalBase

> **⚠️ WARNING:** This is an early alpha release. The service may be immediately useful, but it will likely require modifications for production use.

## Overview

**HyphalBase** is a Cloudflare Worker-based vector database that leverages Durable Objects for storing and retrieving vector embeddings. It supports essential CRUD operations (`put`, `get`, `delete`, `deleteAll`) along with a built-in cosine similarity `search` for finding the most relevant vectors. This project is designed to provide a minimal, self-hosted vector storage solution on Cloudflare’s edge network. 

This is the third iteration of a vector database I have developed, drawing on insights from earlier implementations to refine and optimize this version. The concept is exceptionally powerful and versatile for enabling in-context learning ([ICL](https://github.com/EgoAlpha/prompt-in-context-learning)) when applied to a normalized higher-dimensional abstraction of **any** dataset. 

I’m eager to collaborate and would greatly appreciate your input and assistance!


## Quickstart
```bash
# Install dependencies and start the hyphalbase server.
$ <pnpm|npm|yarn> install && wrangler dev


# (Optional) Define a reference id to make testing easier.
$ export EXAMPLE_RECORD_ID=123e4567-e89b-12d3-a456-426614174000


# Save a vector record with EXAMPLE_RECORD_ID (api will generate an a UUIDv4 if not supplied).
$ curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d '{"operation":"put","payload":{"id":"${EXAMPLE_RECORD_ID}","namespace":"exampleNamespace","vector":[0.1,0.2,0.3],"content":"Sample content"}}'


# Get the vector record.
$ curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d '{"operation":"get","payload":{"id":"${EXAMPLE_RECORD_ID}"}}'


# Search the records (todo: server-side filters [namespace, ect...]).
$ curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d '{"operation":"search","payload":{"vector":[0.1,0.2,0.3],"topN":5}}'


# Delete the vector record.
$ curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d '{"operation":"delete","payload":{"id":"${EXAMPLE_RECORD_ID}"}}'


# Delete all the records.
$ curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d '{"operation":"deleteAll"}'
```

## Philosophy

1. **Simplicity First**: Keep the codebase easy to understand and maintain.
2. **Edge-Driven**: Store data closer to the users and reduce latency by leveraging Cloudflare’s global network.
3. **Scalable**: Durable Objects allow for isolated and horizontally scalable data storage.

## Features

### Vector Storage and Retrieval
- **Put**: Insert or update a vector (with an auto-generated or custom UUID).
- **Get**: Retrieve a specific vector by its UUID.
- **Delete**: Remove a specific vector from the storage.
- **DeleteAll**: Wipe out the entire data set (use with caution).

### Similarity Search
- **Cosine Similarity**: Quickly compute similarity to rank vectors.
- **Top-N Results**: Return only the top matches based on the similarity score.

### Data Handling
- **Binary Encoding**: Vectors are stored as binary blobs using `Float32Array`.
- **Namespace Support**: Organize your vectors within logical namespaces.

### Resilient Edge Deployment
- **Cloudflare Workers + Durable Objects**: Each Durable Object can store data for one or more namespaces, providing horizontal scalability.
- **Fast Global Access**: Serve embeddings across the globe with minimal latency.

## Requirements

- **Node.js** (>=14.0.0 recommended)
- **Cloudflare Wrangler CLI** (for local development and deployment)
- **Cloudflare Account** (to create and manage your Durable Objects)
- **Bun** (optional, used for development scripts in this repository)

## Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/seemueller-io/hyphalbase.git
   cd hyphalbase
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```
   or
   ```bash
   bun install
   ```

3. **Configure Wrangler**
   Make sure you have [Wrangler](https://developers.cloudflare.com/workers/wrangler/get-started/) installed and that you’ve logged in to your Cloudflare account:
   ```bash
   pnpm install -g wrangler
   wrangler login
   ```

## Usage

### Local Development

Run a local version of your Worker with Durable Objects by using Wrangler’s dev mode:

```bash
pnpm run dev
```

This will spin up a local server on [`localhost:8787`](http://localhost:8787). Any request path will be routed to the `HyphalObject` Durable Object instance, which handles your `put`, `get`, `delete`, `deleteAll`, and `search` operations.

### Deployment

Deploy your Worker to Cloudflare:

```bash
pnpm run deploy
```

Wrangler will package and upload your code, creating or updating the Durable Object if needed. Once deployed, your Worker will be live at the assigned domain/subdomain configured in your `wrangler.toml`.

### Programmatic Usage

This project is mainly designed for a Worker environment, so direct usage outside the Cloudflare ecosystem isn’t the primary focus. However, you can interact with the Worker endpoints using standard fetch requests. For example:

```javascript
// Example: PUT request to store a vector
fetch('https://your-worker-url/someObjectName', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'put',
    payload: {
      id: 'optional-custom-uuid',
      namespace: 'exampleNamespace',
      vector: [0.1, 0.2, 0.3],
      content: 'Sample content'
    }
  })
})
  .then(res => res.json())
  .then(data => {
    console.log('Stored vector ID:', data.id);
  });
```

## Configuration

### Environment Variables
You may need to provide environment variables via `.env` or through Wrangler’s configuration interface, particularly if you plan to integrate with external embedding services (e.g., OpenAI). For instance:
```plaintext
FIREWORKS_API_KEY=sk-some-api-key
```
*(Be sure to never commit actual API keys to source control!)*

### Wrangler Config
Your `wrangler.toml` should declare a Durable Object binding:
```toml
[durable_objects]
bindings = [
  { name = "HYPHAL_OBJECT", class_name = "HyphalObject" }
]
```
This binding is what allows your Worker to create and manage the `HyphalObject` Durable Object instance.

## Development

This repository includes scripts to test and seed the database as well as to run local development using Bun or npm:

```bash
# Bun examples
bun run dev         # Start local dev server
bun run test        # Run tests
bun run build       # Build the project
bun run seed        # Seed example data

# NPM equivalents
pnpm run dev
pnpm run test
pnpm run build
pnpm run seed
```

## Project Structure

```plaintext
.
├── scripts/
│   ├── seed.ts             # Example script for seeding data
│   ├── test_*.js           # Demo scripts for deleting/putting data
└── src/
    ├── hyphal_object.ts    # Core Durable Object logic
    └── index.ts            # Worker entrypoint, routes fetch requests
```

### Notable Files

- **`package.json`**: Includes script definitions for deployment, local development, and testing.
- **`wrangler.toml`**: Cloudflare Workers configuration (not shown in the snippet above, but typically required).
- **`worker-configuration.d.ts`**: Declares the `Env` interface for TypeScript usage with Durable Objects.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

### Guidelines

- Write clear and concise TypeScript code.
- Include tests for any new features.
- Use descriptive commit messages.
- Follow existing code patterns for consistency.
- Document new methods and types in the README if needed.

## Note

Remember that Cloudflare Durable Objects have certain concurrency and storage constraints. For production-grade usage, ensure you assess your application’s scale and data throughput to avoid hitting resource limits.

## License

### GNU AFFERO GENERAL PUBLIC LICENSE
Version 3, 19 November 2007
© 2024 Geoff Seemueller
