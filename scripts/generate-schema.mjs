import { writeFileSync, mkdirSync } from "node:fs";
import { stateJsonSchema } from "../packages/core/dist/index.js";
mkdirSync("schemas", { recursive: true });
writeFileSync(
  "schemas/project-state.schema.json",
  JSON.stringify(stateJsonSchema, null, 2) + "\n",
);
