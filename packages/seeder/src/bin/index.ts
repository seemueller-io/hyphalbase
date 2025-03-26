#!/usr/bin/env node
import {CliCore} from "@tsed/cli-core";

import {config} from "../config/index.js";
import {HelloCommand} from "./HelloCommand.js";

CliCore.bootstrap({
  ...config,
  commands: [
    HelloCommand
  ]
}).catch(console.error);
