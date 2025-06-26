import OpenAI from 'openai';
import { EMBEDDINGS_MODEL, OPENAI_API_ENDPOINT, OPENAI_API_KEY } from '../vars';

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
export const generateEmbedding = async (value: string): Promise<number[]> => {
	try {
		// Initialize OpenAI client lazily to avoid errors when importing but not using this function
		const openai = new OpenAI({
			apiKey: OPENAI_API_KEY,
			baseURL: OPENAI_API_ENDPOINT,
		});

		const input = cleanInput(value);

		console.log(`Generating embedding for text of length ${input.length}`);
		const { data } = await openai.embeddings.create({
			model: EMBEDDINGS_MODEL,
			input,
			dimensions: 768,
			encoding_format: "float"
		});
		const result = data[0].embedding;

		const zeroValues = result.filter(x => x === 0).length;
		const nanValues = result.filter(x => Number.isNaN(x)).length;
		if (zeroValues > 0) console.log(`Warning: ${zeroValues} zero values found`);
		if (nanValues > 0) console.log(`Warning: ${nanValues} NaN values found`);

		return result;
	} catch (error) {
		console.error('Error generating embeddings.', error);
		throw error;
	}
};
