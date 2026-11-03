import type { CodegenConfig } from "@graphql-codegen/cli";

// Schema-only codegen: compile-level proof of the contract→client pipeline
// (AD-17: api-committed schema.graphql is the only cross-stack contract).
// No runtime GraphQL client here — that is AD-18's Apollo cutover epic.
// Output is gitignored (see web/.gitignore); the generated file carries the
// graphql-codegen banner marking it clearly generated.
const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  generates: {
    "src/types/graphql.ts": {
      plugins: ["typescript"],
    },
  },
};

export default config;
