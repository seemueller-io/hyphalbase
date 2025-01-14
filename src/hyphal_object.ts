import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';

export class HyphalObject extends DurableObject {
	private sql: SqlStorage;

	constructor(private ctx: DurableObjectState, private env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;

		
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


				if (!id) {
					id = uuidv4();
				}


				const blob = Buffer.from(this.encodeVectorToBlob(vector));


				this.sql.exec(
					`INSERT OR REPLACE INTO vectors (id, namespace, vectors, content) VALUES (?, ?, ?, ?)`,
					id, namespace, blob, content
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

				const cursor = this.sql.exec(
					`SELECT id, namespace, vectors, content FROM vectors WHERE id = ?`,
					[id]
				);

				
				const results = [];
				for (const row of cursor) {
					results.push(row);
				}

				
				if (results.length === 0) {
					return new Response("Vector not found", { status: 404 });
				}

				
				const row = results[0];
				if (!row || !row.vectors) {
					return new Response("Vector data is corrupted or missing", { status: 500 });
				}

				
				console.log("Vectors column:", row.vectors);

				
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


				this.sql.exec(`DELETE FROM vectors WHERE id = ?`, [id]);

				return new Response("Vector deleted successfully", {
					status: 200,
				});
			}

			case "search": {
				const { vector, topN } = payload;


				const results = this.sql.exec(
					`SELECT id, namespace, vectors, content FROM vectors`
				);


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


				similarities.sort((a, b) => b.similarity - a.similarity);


				const topResults = topN ? similarities.slice(0, topN) : similarities;

				return new Response(JSON.stringify(topResults), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			case "deleteAll": {

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

		if (blob instanceof ArrayBuffer) {
			blob = new Uint8Array(blob);
		}

		if (!(blob instanceof Uint8Array)) {
			throw new TypeError("Invalid blob data for decoding.");
		}


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
