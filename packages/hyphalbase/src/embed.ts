import OpenAI from 'openai';

/**
 * Generate an embedding for the given text using OpenAI's API
 * @param value The text to generate an embedding for
 * @returns A Promise that resolves to an array of numbers (the embedding)
 */
export const generateEmbedding = async (value: string): Promise<number[]> => {
	try {
		// Initialize OpenAI client lazily to avoid errors when importing but not using this function
		const openai = new OpenAI({
			apiKey: process.env['OPENAI_API_KEY'],
		});

		const input = value.replaceAll('\n', ' ');
		console.log("Generating embedding");
		const { data } = await openai.embeddings.create({
			model: 'text-embedding-ada-002',
			input,
		});
		return data[0].embedding;
	} catch (error) {
		console.error("Error generating embeddings.", error)
		throw error;
	}

};
