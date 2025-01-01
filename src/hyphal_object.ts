import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid'; // Import a UUID library

export class HyphalObject extends DurableObject {
	private sql: SqlStorage;

	constructor(private ctx: DurableObjectState, private env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		// Initialize the vectors table with UUID as the primary key
		this.sql.exec(`
      CREATE TABLE IF NOT EXISTS vectors(
        id TEXT PRIMARY KEY,       -- Use UUID as TEXT
        namespace TEXT,
        vectors BLOB NOT NULL,
        content TEXT
      );
    `);
	}

	async fetch(request: Request): Promise<Response> {
		const { operation, payload } = await request.json();
		return this.execute(operation, payload);
	}

	async execute(operation: string, payload: any): Promise<Response> {
		switch (operation) {
			case "put": {
				let { id, namespace, vector, content } = payload;

				// Generate a UUID if id is not provided
				if (!id) {
					id = uuidv4();
				}

				// Encode the vector into a BLOB
				const blob = Buffer.from(this.encodeVectorToBlob(vector));

				// Insert or replace the vector in the database
				this.sql.exec(
					`INSERT OR REPLACE INTO vectors (id, namespace, vectors, content) VALUES (?, ?, ?, ?)`,
					id, namespace, blob, content // Pass parameters as an array
				);

				return new Response(
					JSON.stringify({ id }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				);
			}
			case "get": {
				const { id } = payload;

				// Retrieve the vector from the database
				const cursor = this.sql.exec(
					`SELECT id, namespace, vectors, content FROM vectors WHERE id = ?`,
					[id] // Pass parameters as an array
				);

				// Convert the Cursor into a usable object
				const results = [];
				for (const row of cursor) {
					results.push(row);
				}

				// Ensure results are valid
				if (results.length === 0) {
					return new Response("Vector not found", { status: 404 });
				}

				// Extract the first row
				const row = results[0];
				if (!row || !row.vectors) {
					return new Response("Vector data is corrupted or missing", { status: 500 });
				}

				// Debug: Log the vectors column
				console.log("Vectors column:", row.vectors);

				// Decode the vector
				let vector;
				try {
					vector = this.decodeBlobToVector(row.vectors);
				} catch (error) {
					return new Response(`Error decoding vector: ${error.message}`, { status: 500 });
				}

				return new Response(
					JSON.stringify({
						id: row.id,
						namespace: row.namespace,
						vector: vector,
						content: row.content,
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					}
				);
			}

			case "delete": {
				const { id } = payload;

				// Delete the vector from the database
				this.sql.exec(`DELETE FROM vectors WHERE id = ?`, [id]);

				return new Response("Vector deleted successfully", {
					status: 200,
				});
			}

			case "search": {
				const { vector, topN } = payload;

				// Retrieve all vectors from the database
				const results = this.sql.exec(
					`SELECT id, namespace, vectors, content FROM vectors`
				);

				// Compute cosine similarity with each vector
				const similarities = results.map((row) => {
					const storedVector = this.decodeBlobToVector(row.vectors);
					const similarity = this.cosineSimilarity(vector, storedVector);
					return {
						id: row.id,
						namespace: row.namespace,
						content: row.content,
						similarity: similarity,
					};
				});

				// Sort by similarity in descending order
				similarities.sort((a, b) => b.similarity - a.similarity);

				// Return top N results if specified
				const topResults = topN ? similarities.slice(0, topN) : similarities;

				return new Response(JSON.stringify(topResults), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			case "deleteAll": {
				// Delete all vectors from the database
				this.sql.exec(`DELETE FROM vectors`);

				return new Response("All vectors deleted successfully", {
					status: 200,
				});
			}

			default:
				return new Response("Invalid operation", { status: 400 });
		}
	}

	encodeVectorToBlob(vector: number[]): Uint8Array {
		const buffer = new ArrayBuffer(vector.length * Float32Array.BYTES_PER_ELEMENT);
		const view = new Float32Array(buffer);
		for (let i = 0; i < vector.length; i++) {
			view[i] = vector[i];
		}
		return new Uint8Array(buffer);
	}

	decodeBlobToVector(blob: ArrayBuffer | Uint8Array): number[] {
		// If the input is an ArrayBuffer, convert it to a Uint8Array
		if (blob instanceof ArrayBuffer) {
			blob = new Uint8Array(blob);
		}

		if (!(blob instanceof Uint8Array)) {
			throw new TypeError("Invalid blob data for decoding.");
		}

		// Handle the decoding process
		const buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
		const view = new Float32Array(buffer);
		return Array.from(view);
	}


	cosineSimilarity(vecA: number[], vecB: number[]): number {
		let dotProduct = 0;
		let magnitudeA = 0;
		let magnitudeB = 0;

		for (let i = 0; i < vecA.length; i++) {
			dotProduct += vecA[i] * vecB[i];
			magnitudeA += vecA[i] ** 2;
			magnitudeB += vecB[i] ** 2;
		}

		magnitudeA = Math.sqrt(magnitudeA);
		magnitudeB = Math.sqrt(magnitudeB);

		if (magnitudeA === 0 || magnitudeB === 0) {
			return 0;
		}

		return dotProduct / (magnitudeA * magnitudeB);
	}
}
