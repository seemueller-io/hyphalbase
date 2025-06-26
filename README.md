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


```shell
pnpm i
# start the embeddings server (openai compat)
(cd crates/embeddings-server && cargo run)
pnpm test
cd packages/hyphalbase && pnpm dev
```
