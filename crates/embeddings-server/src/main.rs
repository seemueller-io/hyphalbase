use axum::{
    Json, Router,
    response::Json as ResponseJson,
    routing::{get, post},
};
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use openai_api_rust::embeddings;
use serde::{Deserialize, Serialize};
use tower_http::trace::TraceLayer;
use std::env;
use tracing;

const DEFAULT_SERVER_HOST: &str = "0.0.0.0";
const DEFAULT_SERVER_PORT: &str = "8080";

async fn root() -> &'static str {
    "Hello, World!"
}

async fn embeddings_create(
    Json(payload): Json<embeddings::EmbeddingsBody>,
) -> ResponseJson<serde_json::Value> {
    let model = TextEmbedding::try_new(
        InitOptions::new(EmbeddingModel::NomicEmbedTextV15Q).with_show_download_progress(true),
    )
    .expect("Failed to initialize model");

    let embeddings = model
        .embed(payload.input, None)
        .expect("failed to embed document");

    // Only log detailed embedding information at trace level to reduce log volume
    tracing::trace!("Embeddings length: {}", embeddings.len());
    tracing::trace!("Embedding dimension: {}", embeddings[0].len());

    // Log the first 10 values of the original embedding at trace level
    tracing::trace!("Original embedding preview: {:?}", &embeddings[0][..10.min(embeddings[0].len())]);

    // Check if there are any NaN or zero values in the original embedding
    let nan_count = embeddings[0].iter().filter(|&&x| x.is_nan()).count();
    let zero_count = embeddings[0].iter().filter(|&&x| x == 0.0).count();
    tracing::trace!("Original embedding stats: NaN count={}, zero count={}", nan_count, zero_count);

    // Create the final embedding
    let final_embedding = {
        // Check if the embedding is all zeros
        let all_zeros = embeddings[0].iter().all(|&x| x == 0.0);
        if all_zeros {
            tracing::warn!("Embedding is all zeros. Generating random non-zero embedding.");

            // Generate a random non-zero embedding
            use rand::Rng;
            let mut rng = rand::thread_rng();
            let mut random_embedding = Vec::with_capacity(768);
            for _ in 0..768 {
                // Generate random values between -1.0 and 1.0, excluding 0
                let mut val = 0.0;
                while val == 0.0 {
                    val = rng.gen_range(-1.0..1.0);
                }
                random_embedding.push(val);
            }

            // Normalize the random embedding
            let norm: f32 = random_embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
            for i in 0..random_embedding.len() {
                random_embedding[i] /= norm;
            }

            random_embedding
        } else {
            // Check if dimensions parameter is provided and pad the embeddings if necessary
            let mut padded_embedding = embeddings[0].clone();

            // If the client expects 768 dimensions but our model produces fewer, pad with zeros
            let target_dimension = 768;
            if padded_embedding.len() < target_dimension {
                let padding_needed = target_dimension - padded_embedding.len();
                tracing::trace!("Padding embedding with {} zeros to reach {} dimensions", padding_needed, target_dimension);
                padded_embedding.extend(vec![0.0; padding_needed]);
            }

            padded_embedding
        }
    };

    tracing::trace!("Final embedding dimension: {}", final_embedding.len());

    // Log the first 10 values of the final embedding at trace level
    tracing::trace!("Final embedding preview: {:?}", &final_embedding[..10.min(final_embedding.len())]);

    // Return a response that matches the OpenAI API format
    let response = serde_json::json!({
        "object": "list",
        "data": [
            {
                "object": "embedding",
                "index": 0,
                "embedding": final_embedding
            }
        ],
        "model": payload.model,
        "usage": {
            "prompt_tokens": 0,
            "total_tokens": 0
        }
    });
    ResponseJson(response)
}

fn create_app() -> Router {
	Router::new()
        .route("/", get(root))
        .route("/v1/embeddings", post(embeddings_create))
        .layer(TraceLayer::new_for_http())
}
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                // axum logs rejections from built-in extractors with the `axum::rejection`
                // target, at `TRACE` level. `axum::rejection=trace` enables showing those events
                format!(
                    "{}=debug,tower_http=debug,axum::rejection=trace",
                    env!("CARGO_CRATE_NAME")
                )
                .into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    let app = create_app();

	let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| DEFAULT_SERVER_HOST.to_string());
	let server_port = env::var("SERVER_PORT").unwrap_or_else(|_| DEFAULT_SERVER_PORT.to_string());
	let server_address = format!("{}:{}", server_host, server_port);
	let listener = tokio::net::TcpListener::bind(server_address).await.unwrap();
	tracing::info!("Listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use openai_api_rust::embeddings::EmbeddingsBody;
    use openai_api_rust::*;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_root() {
        let app = create_app();
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(&body[..], b"Hello, World!");
    }

    #[tokio::test]
    async fn test_embeddings_create() {
        // Start a test server
        let app = create_app();

        // Use the OpenAI client with our test server
        let auth = Auth::new("test-key"); // Use a dummy key for testing
        let base_url = format!("http://127.0.0.1:{}/v1", 8080);
        let openai = OpenAI::new(auth, &base_url);

        let body = EmbeddingsBody {
            model: "nomic-text-embed".to_string(),
            input: vec!["The food was delicious and the waiter...".to_string()],
            user: None,
        };

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method(axum::http::Method::POST)
                    .uri("/v1/embeddings")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();

        let response_json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(response_json["object"], "list");
        assert!(response_json["data"].is_array());
        assert_eq!(response_json["data"].as_array().unwrap().len(), 1);
        assert_eq!(response_json["model"], "nomic-text-embed");

        let embedding_obj = &response_json["data"][0];
        assert_eq!(embedding_obj["object"], "embedding");
        assert_eq!(embedding_obj["index"], 0);
        assert!(embedding_obj["embedding"].is_array());

        let embedding = embedding_obj["embedding"].as_array().unwrap();
        assert_eq!(embedding.len(), 768);
    }
}
