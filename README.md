# hyphalbase

[![Build](https://github.com/seemueller-io/hyphalbase/actions/workflows/main.yml/badge.svg)](https://github.com/seemueller-io/hyphalbase/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="https://github.com/seemueller-io/hyphalbase/blob/main/hyphalbase.png?raw=true" width="250" />
</p>

<p align="center">
A vector database built on top of DurableObject SQLite exposed via GraphQL.
</p>

## Prerequisites

- cargo/Rust
- pnpm/Node

```bash
# Install dependencies

pnpm i

# Start the OpenAI-compatible embeddings server

(cd crates/embeddings-server && cargo run)

# Run test suite

pnpm test

# Start development server

cd packages/hyphalbase && pnpm dev

# Development Setup:

# 1. Navigate to the admin control interface http://localhost:8787/admin in your browser

# 2. Using the GraphQL interface:

# - Create a new user account

# - Generate an API key for the user

# 3. Navigate to the interface at http://localhost:8787/graphql

# 4. Create an embedding query

# 5. Include the generated API key in requests via X-API-Key header
```
