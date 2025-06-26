use axum::{
	routing::get,
	Router,
};

async fn root() -> &'static str {
	"Hello, World!"
}

#[tokio::main]
async fn main() {
	// build our application with a single route
	let app = Router::new().route("/", get(root));

	// run our app with hyper, listening globally on port 3000
	let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
	axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
	use axum::body::to_bytes;
use super::*;
	use axum::http::StatusCode;
	use axum::body::Body;
	use tower::ServiceExt;

	#[tokio::test]
	async fn test_root() {
		let app = Router::new().route("/", get(root));
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
		
		let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
		assert_eq!(&body[..], b"Hello, World!");
	}
}

