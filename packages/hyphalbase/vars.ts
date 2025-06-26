const defaults = {
	openaiApiKey: "not-needed",
	// default ollama endpoint
	openaiEndpoint: "http://localhost:11434/v1",
	// https://ollama.com/library/nomic-embed-text
	embeddingsModel: "nomic-embed-text",
};

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] ?? defaults.openaiApiKey;
const OPENAI_API_ENDPOINT = process.env['OPENAI_API_ENDPOINT'] ?? defaults.openaiEndpoint;
const EMBEDDINGS_MODEL = process.env['EMBEDDINGS_MODEL'] ?? defaults.embeddingsModel;

export { OPENAI_API_KEY, OPENAI_API_ENDPOINT, EMBEDDINGS_MODEL };
