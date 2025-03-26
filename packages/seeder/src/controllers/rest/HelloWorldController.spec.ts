import { PlatformTest } from "@tsed/platform-http/testing";
import { afterEach,beforeEach, describe, expect, it } from "vitest";

import { HelloWorldController } from "./HelloWorldController.js";

describe("HelloWorldController", () => {
  beforeEach(PlatformTest.create);
  afterEach(PlatformTest.reset);

  it("should do something", () => {
    const instance = PlatformTest.get<HelloWorldController>(HelloWorldController);
    // const instance = PlatformTest.invoke<HelloWorldController>(HelloWorldController); // get fresh instance

    expect(instance).toBeInstanceOf(HelloWorldController);
  });
});
