import OpenAI from 'openai';

const fireworksOpenAIClient = new OpenAI({
	apiKey: process.env.FIREWORKS_API_KEY,
	baseURL: "https://api.fireworks.ai/inference/v1"
});

const embedding = await fireworksOpenAIClient.embeddings.create({
	model: "nomic-ai/nomic-embed-text-v1.5",
	input: "this is just a test",
	encoding_format: "float"
});

console.log(JSON.stringify(embedding));
