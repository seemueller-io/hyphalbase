const defaults = {
  openaiApiKey: 'not-needed',
  // default ollama endpoint
  openaiEndpoint: 'http://localhost:8080/v1',
  // https://ollama.com/library/nomic-embed-text
  embeddingsModel: 'nomic-embed-text',
  // default to no debug logging in production
  debug: false,
};

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] ?? defaults.openaiApiKey;
const OPENAI_API_ENDPOINT = process.env['OPENAI_API_ENDPOINT'] ?? defaults.openaiEndpoint;
const EMBEDDINGS_MODEL = process.env['EMBEDDINGS_MODEL'] ?? defaults.embeddingsModel;
// Enable debug logging only if DEBUG environment variable is set to 'true'
const DEBUG = process.env['DEBUG'] === 'true' || defaults.debug;

export { OPENAI_API_KEY, OPENAI_API_ENDPOINT, EMBEDDINGS_MODEL, DEBUG };
