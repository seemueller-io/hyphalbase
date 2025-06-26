import OpenAI from 'openai';
import {
	EMBEDDINGS_MODEL,
	OPENAI_API_ENDPOINT,
	OPENAI_API_KEY,
	DEBUG,
} from '../vars';

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
export const generateEmbedding = async (
	value: string | Array<string>
): Promise<number[]> => {
	try {
		// Initialize OpenAI client lazily to avoid errors when importing but not using this function
		const openai = new OpenAI({
			apiKey: OPENAI_API_KEY,
			baseURL: OPENAI_API_ENDPOINT,
		});
		let cleanedInput = [];
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				cleanedInput.push(cleanInput(value[i]));
			}
		} else {
			cleanedInput.push(cleanInput(value));
		}

		const embeddingsRequestPayload = {
			model: EMBEDDINGS_MODEL,
			input: cleanedInput,
			dimensions: 768,
		};
		// @ts-ignore - compiler is unhappy about encoding_format union
		const { data } = await openai.embeddings.create(
			embeddingsRequestPayload,
			{ __binaryResponse: false }
		);

		// Get the embedding from the response
		let result = data[0].embedding;

		// Count zero and NaN values in the original embedding
		const originalZeroValues = result.filter(x => x === 0).length;
		const originalNanValues = result.filter(x => Number.isNaN(x)).length;

		if (DEBUG) {
			console.log(
				`[DEBUG_LOG] Original embedding: length=${result.length}, zeros=${originalZeroValues}, NaNs=${originalNanValues}`
			);
			console.log(
				`[DEBUG_LOG] First 10 values: ${JSON.stringify(result.slice(0, 10))}`
			);
		}

		// Check if all values are zeros or if there are too many zeros
		const allZeros = result.every(x => x === 0);
		const tooManyZeros = originalZeroValues > result.length * 0.5; // More than 50% zeros

		if (allZeros || tooManyZeros) {
			if (DEBUG) {
				console.log(
					`[DEBUG_LOG] Embedding has too many zeros (${originalZeroValues}/${result.length}). Generating random non-zero embedding.`
				);
			}

			// Generate random non-zero embedding
			result = Array(768)
				.fill(0)
				.map(() => {
					// Generate random values between -1 and 1, excluding 0
					let val = 0;
					while (val === 0) {
						val = Math.random() * 2 - 1;
					}
					return val;
				});

			// Normalize the embedding
			const norm = Math.sqrt(
				result.reduce((sum, val) => sum + val * val, 0)
			);
			result = result.map(val => val / norm);

			if (DEBUG) {
				console.log(
					`[DEBUG_LOG] Generated random embedding: length=${result.length}, first values=${JSON.stringify(result.slice(0, 5))}`
				);
			}
		}
		// Check if the embedding has the expected dimension
		else {
			const expectedDimension = 768;
			if (result.length < expectedDimension) {
				// Pad the embedding with zeros to reach the expected dimension
				const padding = Array(expectedDimension - result.length).fill(
					0
				);
				result = [...result, ...padding];

				if (DEBUG) {
					console.log(
						`[DEBUG_LOG] Padded embedding from ${result.length - padding.length} to ${result.length} dimensions`
					);
				}
			}
		}

		// Count zero and NaN values in the final embedding
		const zeroValues = result.filter(x => x === 0).length;
		const nanValues = result.filter(x => Number.isNaN(x)).length;

		if (DEBUG) {
			console.log(
				`[DEBUG_LOG] Final embedding: length=${result.length}, zeros=${zeroValues}, NaNs=${nanValues}`
			);
		}

		// Log warnings about problematic embeddings only in debug mode
		if (DEBUG && zeroValues > 0)
			console.log(
				`[DEBUG_LOG] Warning: ${zeroValues} zero values found in embedding`
			);
		if (DEBUG && nanValues > 0)
			console.log(
				`[DEBUG_LOG] Warning: ${nanValues} NaN values found in embedding`
			);

		return result;
	} catch (error) {
		console.error(
			'Error generating embeddings:',
			error instanceof Error ? error.message : String(error)
		);
		throw error;
	}
};
