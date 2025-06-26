use axum::{
    Json, Router,
    response::Json as ResponseJson,
    routing::{get, post},
};
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use openai_api_rust::embeddings;
use serde::{Deserialize, Serialize};

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

    println!("Embeddings length: {}", embeddings.len()); // -> Embeddings length: 4
    println!("Embedding dimension: {}", embeddings[0].len()); // -> Embedding dimension: 384

    // Return a response that matches the OpenAI API format
    let response = serde_json::json!({
        "object": "list",
        "data": [
            {
                "object": "embedding",
                "index": 0,
                "embedding": embeddings[0]
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
}

#[tokio::main]
async fn main() {
    let app = create_app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
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
