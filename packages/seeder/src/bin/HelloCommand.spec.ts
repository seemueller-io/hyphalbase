import { PlatformTest } from "@tsed/platform-http/testing";
import { afterEach,beforeEach, describe, expect, it } from "vitest";

import { HelloCommand } from "./HelloCommand.js";

describe("HelloCommand", () => {
  beforeEach(PlatformTest.create);
  afterEach(PlatformTest.reset);

  it("should do something", () => {
    const instance = PlatformTest.get<HelloCommand>(HelloCommand);
    // const instance = PlatformTest.invoke<HelloCommand>(HelloCommand); // get fresh instance

    expect(instance).toBeInstanceOf(HelloCommand);
  });
});
