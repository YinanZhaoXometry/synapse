/**
 * The e2e stub AI provider (harness-only; no product code). An
 * OpenAI-compatible POST /chat/completions double that the backend's
 * GlmClient talks to when backend/.dockerdev/compose.e2e.yaml points
 * PROVIDER_BASE_URL here.
 *
 * Deterministic replies per prompt shape (the Ai::Prompts builders are the
 * contract — this stub matches on their stable opening lines):
 *   - plan proposal  → the frozen <outline>/<proposal> tag contract, echoing
 *     the topic the prompt carried.
 *   - quiz           → {"questions":[…]} citing REAL ids regexed out of the
 *     assembled context ([material id=…], [section id=…], [node id=…]) — the
 *     server's normalization would drop questions citing ids the context does
 *     not carry, so fabrication here would fail loudly, not silently.
 *   - anything else  → a plain-text reply; an unexpected AI surface fails its
 *     downstream JSON parse (INTERNAL) instead of being silently faked.
 *
 * stream:true rides the SSE wire GlmClient parses: `data: {json}` lines whose
 * deltas live at choices[0].delta.content, closed by `data: [DONE]`.
 */
import http from "node:http";

const port = Number(process.env.E2E_PROVIDER_PORT || 8791);

// The stub's three choice questions share one shape; the correct index walks
// 0 → 1 → 2 so a test can answer one wrong on purpose (the Mistakes path).
function quizReply(text) {
  const materialId = (text.match(/\[material id=(.+?) title=/) ?? [])[1];
  const sectionId = (text.match(/\[section id=(.+?)[\]\s]/) ?? [])[1];
  const nodeId = (text.match(/\[node id=(.+?)[\]\s]/) ?? [])[1];
  if (!materialId || !sectionId || !nodeId) {
    return "Stub could not find material/section/node ids in the quiz context.";
  }
  const options = ["The stub answer", "A distractor", "Another distractor", "The last distractor"];
  const question = (n, correctIndex) => ({
    nodeId,
    kind: "choice",
    prompt: `Stub question ${n}: which option is the study answer?`,
    options,
    correctOptionIndex: correctIndex,
    sourceMaterialId: materialId,
    sourceSectionId: sectionId,
    keywords: ["stub"],
    explanation: `Stub explanation ${n}.`,
  });
  return JSON.stringify({
    questions: [question(1, 0), question(2, 1), question(3, 2)],
  });
}

function proposalReply(text) {
  const topic = (text.match(/Topic: (.+?)\./) ?? [])[1] ?? "Stub plan";
  return [
    "<outline>",
    "Stage 1: 打地基",
    "- 概念地图",
    "- 练习闭环",
    "</outline>",
    "<proposal>",
    JSON.stringify({ topic, stages: [{ name: "打地基", nodeTitles: ["概念地图", "练习闭环"] }] }),
    "</proposal>",
  ].join("\n");
}

function replyFor(messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const text = lastUser?.content ?? "";

  if (text.startsWith("Design a study plan. Topic:")) return proposalReply(text);
  if (text.includes("quiz questions")) return quizReply(text);
  return "Stub reply.";
}

function sseChunks(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 48) chunks.push(text.slice(i, i + 48));
  return chunks;
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && (request.url === "/healthz" || request.url === "/healthz/")) {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405).end();
    return;
  }

  const body = [];
  request.on("data", (chunk) => body.push(chunk));
  request.on("end", () => {
    let payload = {};
    try {
      payload = JSON.parse(Buffer.concat(body).toString("utf8"));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "stub could not parse the request body" } }));
      return;
    }

    const reply = replyFor(payload.messages ?? []);
    if (payload.stream) {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      for (const chunk of sseChunks(reply)) {
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
  });
});

// Loopback by default — the local api container reaches the host through
// Docker Desktop's built-in host.docker.internal. CI (Linux runners) needs
// the stub reachable via the host-gateway bridge instead, so it binds all
// interfaces there (E2E_PROVIDER_HOST=0.0.0.0 in the ci.yml e2e job).
const host = process.env.E2E_PROVIDER_HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`e2e stub provider listening on http://${host}:${port}`);
});
