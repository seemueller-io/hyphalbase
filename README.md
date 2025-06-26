# hyphalbase

[![Build](https://github.com/seemueller-io/hyphalbase/actions/workflows/main.yml/badge.svg)](https://github.com/seemueller-io/hyphalbase/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A vector database built on top of DurableObject SQLite exposed via GraphQL.

## Prerequisites
- cargo/Rust
- pnpm/Node


```shell
pnpm i
# start the embeddings server (openai compat)
(cd crates/embeddings-server && cargo run)
pnpm test
cd packages/hyphalbase && pnpm dev
```
