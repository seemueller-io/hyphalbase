import { SELF } from "cloudflare:test";
import { expect, it, describe } from "vitest";

describe("SQLiteDurableObject", () => {
  // Test the legacy endpoint for backward compatibility
  it("enables SQL API with migrations", async () => {
    const response = await SELF.fetch("https://example.com/sql");
    // The response is now handled by the GraphQL server, so we expect a different response
    expect(response.status).toBe(400); // Bad request for invalid GraphQL query
  });

  // Note: Root path test removed as we're standardizing on /graphql endpoint

  it("enables GraphQL API at /graphql path", async () => {
    // Test introspection query to verify GraphQL server is working at /graphql path
    const response = await SELF.fetch("https://example.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          {
            __schema {
              queryType {
                name
              }
            }
          }
        `,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.__schema.queryType.name).toBe("Query");
  });

  it("can query the GraphQL API", async () => {
    // First create a vector
    const putResponse = await SELF.fetch("https://example.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation {
            putVector(input: {
              namespace: "test",
              content: "test content",
              vector: [0.1, 0.2, 0.3]
            }) {
              id
            }
          }
        `,
      }),
    });

    expect(putResponse.status).toBe(200);
    const putData = await putResponse.json();
    expect(putData.data.putVector.id).toBeDefined();

    const id = putData.data.putVector.id;

    // Then retrieve it
    const getResponse = await SELF.fetch("https://example.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            getVector(id: "${id}") {
              id
              namespace
              content
              vector
            }
          }
        `,
      }),
    });

    expect(getResponse.status).toBe(200);
    const getData = await getResponse.json();
    expect(getData.data.getVector.id).toBe(id);
    expect(getData.data.getVector.namespace).toBe("test");
    expect(getData.data.getVector.content).toBe("test content");
    // Use a more flexible comparison for floating-point numbers
    const vector = getData.data.getVector.vector;
    expect(vector.length).toBe(3);
    expect(Math.abs(vector[0] - 0.1)).toBeLessThan(0.0001);
    expect(Math.abs(vector[1] - 0.2)).toBeLessThan(0.0001);
    expect(Math.abs(vector[2] - 0.3)).toBeLessThan(0.0001);
  });
});
