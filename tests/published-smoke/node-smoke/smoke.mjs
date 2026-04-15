#!/usr/bin/env node
import { EXPECTED_EXPORTS } from "../shared/export-expectations.mjs";
import { NODE_SMOKE_PACKAGES } from "../shared/groups.mjs";
import { runSmoke } from "./smoke-runner.mjs";

const code = await runSmoke(NODE_SMOKE_PACKAGES, EXPECTED_EXPORTS);
process.exit(code);
