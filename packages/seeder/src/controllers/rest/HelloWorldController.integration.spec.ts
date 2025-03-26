import { PlatformTest } from "@tsed/platform-http/testing";
import SuperTest from "supertest";
import { afterAll, beforeAll,describe, expect, it } from "vitest";

import { Server } from "../../Server.js";
import { HelloWorldController } from "./HelloWorldController.js";

describe("HelloWorldController", () => {
  beforeAll(PlatformTest.bootstrap(Server, {
    mount: {
      "/": [HelloWorldController]
    }
  }));
  afterAll(PlatformTest.reset);

  it("should call GET /hello-world", async () => {
     const request = SuperTest(PlatformTest.callback());
     const response = await request.get("/hello-world").expect(200);

     expect(response.text).toEqual("hello");
  });
});
