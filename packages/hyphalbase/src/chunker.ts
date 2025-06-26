import { encode, decode } from 'gpt-tokenizer';

/* ─────────────── Types ─────────────── */

export interface Chunk {
  id: number;
  text: string;
  tokenStart: number; // inclusive
  tokenEnd: number; // exclusive
}

export interface ChunkOpts {
  chunkSize?: number; // default = 768 tokens
  overlap?: number; // default = 115 tokens (≈15 %)
  boundaryRegex?: RegExp | null; // default trims to last sentence / newline
}

/* ─────────────── Utility ─────────────── */

export function checkTokenLimit(text: string, limit: number): number | false {
  const tokens = encode(text);
  return tokens.length <= limit ? tokens.length : false;
}

/* ─────────────── Core iterator ─────────────── */

function* _chunkIterator(
  raw: string,
  { chunkSize, overlap, boundaryRegex }: Required<ChunkOpts>,
): Generator<Chunk, void, unknown> {
  const tokens = encode(raw);
  overlap = Math.max(0, Math.min(overlap, chunkSize - 1, tokens.length - 1));

  let startTok = 0;
  let id = 0;

  while (startTok < tokens.length) {
    let endTok = Math.min(startTok + chunkSize, tokens.length);

    // Optional rollback to boundary
    if (boundaryRegex && endTok < tokens.length) {
      const slice = decode(tokens.slice(startTok, endTok));
      const candidates = slice.match(boundaryRegex) ?? [];
      const lastHitPos = slice.lastIndexOf(candidates.pop() ?? '');
      if (lastHitPos > -1 && lastHitPos > slice.length * 0.5) {
        endTok = startTok + encode(slice.slice(0, lastHitPos + 1)).length;
      }
    }

    yield {
      id: id++,
      text: decode(tokens.slice(startTok, endTok)),
      tokenStart: startTok,
      tokenEnd: endTok,
    };

    if (endTok >= tokens.length) break;
    startTok = endTok - overlap;
  }
}

/* ─────────────── Public API ─────────────── */

/**
 * Eager splitter – returns an array of chunks.
 */
export function chunkDocument(
  input: string | { content: string }[],
  opts: ChunkOpts = {},
): Chunk[] {
  const raw = Array.isArray(input) ? input.map(o => o.content).join(' ') : input;
  const { chunkSize = 768, overlap = 115, boundaryRegex = /[.\n]/ } = opts;
  return [..._chunkIterator(raw, { chunkSize, overlap, boundaryRegex })];
}

/**
 * Lazy splitter – yields chunks one by one using a generator.
 */
export function chunkDocumentGenerator(
  input: string | { content: string }[],
  opts: ChunkOpts = {},
): Generator<Chunk, void, unknown> {
  const raw = Array.isArray(input) ? input.map(o => o.content).join(' ') : input;
  const { chunkSize = 768, overlap = 115, boundaryRegex = /[.\n]/ } = opts;
  return _chunkIterator(raw, { chunkSize, overlap, boundaryRegex });
}
