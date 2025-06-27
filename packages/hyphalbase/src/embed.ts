import OpenAI from 'openai';
import { type Embedding, EmbeddingCreateParams } from 'openai/resources';

import { getProcess } from '../vars';

// not robust but will get the job done for now
// TODO: add more robust cleaning to reduce noise
function cleanInput(value: string) {
  return value.replaceAll('\n', ' ');
}

/**
 * Generate an embedding for the given text using OpenAI's API
 * @param value The text to generate an embedding for
 * @returns A Promise that resolves to an array of numbers (the embedding)
 */
export const generateEmbedding = async (values: Array<string>): Promise<Embedding[]> => {
  const process = getProcess();
  // Initialize OpenAI client lazily to avoid errors when importing but not using this function
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_ENDPOINT,
  });

  const embeddingsRequestPayload: EmbeddingCreateParams = {
    model: process.env.EMBEDDINGS_MODEL,
    input: values,
    dimensions: 768,
    encoding_format: 'float',
  };

  // const { data } = await openai.embeddings.create(embeddingsRequestPayload);
  const request = await openai.embeddings.create(embeddingsRequestPayload);

  // console.log(JSON.stringify({ request }));

  const data = request.data;

  const embedding = request.data.at(0)!.embedding;

  // console.log({ data: embedding.length });

  // Get the embedding from the response
  return data;
};
