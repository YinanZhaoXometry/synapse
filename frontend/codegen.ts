import type { CodegenConfig } from "@graphql-codegen/cli";

// The contract→client pipeline (AD-17: backend/schema.graphql is the only
// cross-stack contract; AD-18: Apollo + codegen typed-document-node own domain
// data). Epic P2-8 T1 grew this from schema-only type proof to the full
// operations pipeline, and flipped the output policy: the generated file is
// COMMITTED now — the typed documents are runtime-load-bearing (features
// import them), so CI pins freshness with a regenerate+diff gate instead of a
// gitignore. The generated file still carries the graphql-codegen banner.
const config: CodegenConfig = {
  schema: "../backend/schema.graphql",
  documents: ["src/lib/graphql/*.graphql"],
  generates: {
    "src/types/graphql.ts": {
      // typescript-operations alone (no bare `typescript` plugin): both emit
      // input types — together they collide as duplicate identifiers. The
      // operations-reachable types are exactly what the app consumes.
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        scalars: {
          DateTime: { input: "string", output: "string" },
        },
      },
    },
  },
};

export default config;
