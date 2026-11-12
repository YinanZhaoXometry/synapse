/**
 * The e2e stub AI provider (harness-only; no product code). An
 * OpenAI-compatible POST /chat/completions double that the backend's
 * AI transport talks to when backend/.dockerdev/compose.e2e.yaml points
 * PROVIDER_BASE_URL here.
 *
 * Deterministic replies per prompt shape (the Ai::Prompts builders are the
 * contract — this stub matches on their stable opening lines):
 *   - plan proposal  → the frozen <outline>/<proposal> tag contract, echoing
 *     the topic the prompt carried — the fixed 16-node roadmap proposal
 *     (epic-16 wire shape; one backward edge the server drops + cross-stage
 *     pairs the spine era withholds from rendering; see
 *     proposalReply below).
 *   - quiz           → {"questions":[…]} citing REAL ids regexed out of the
 *     assembled context ([material id=…], [section id=…], [node id=…]) — the
 *     server's normalization would drop questions citing ids the context does
 *     not carry, so fabrication here would fail loudly, not silently.
 *   - lesson outline (epic-36) → {"chapters":[{title, sourceSectionIds}]} —
 *     the real section ids split deterministically into two chapters.
 *   - lesson section fill (epic-36) → the chapter Markdown (## heading +
 *     recap), title regexed out of the prompt.
 *   - anything else  → a plain-text reply; an unexpected AI surface fails its
 *     downstream JSON parse (INTERNAL) instead of being silently faked.
 *
 * stream:true rides the SSE wire the backend transport parses: `data: {json}` lines whose
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

/**
 * The fixed 16-node proposal (epic-16 T4, ticket 04): the epic-16 wire shape —
 * stages carry full nodes ({title, description, optional}) and top-level
 * title-paired edges [[fromTitle, toTitle]] — at the schema cap (16 nodes,
 * grill decision 3), four stages, every node described, one optional node,
 * and every node outside the first stage carrying ≥1 inbound edge.
 *
 * Exactly ONE deliberately invalid edge rides along — ["模拟面试复盘",
 * "复杂度分析"], a BACKWARD pair (stage 4 → stage 1). Its titles resolve
 * cleanly (so the client flatten seam forwards it), and the server's
 * stage-forward validity drops it silently-but-logged
 * (Plans::PlanCreation#drop_edge) — the e2e roadmap spec asserts the pair is
 * absent from the rendered graph while all 12 valid forward arrows render.
 */
const STUB_PROPOSAL_STAGES = [
  {
    name: "基础奠基",
    nodes: [
      { title: "复杂度分析", description: "大 O、均摊分析与常见代价模型", optional: false },
      { title: "数组与链表", description: "线性结构的取舍与操作代价", optional: false },
      { title: "栈与队列", description: "受限访问顺序与典型套路", optional: false },
      { title: "哈希表原理", description: "散列、冲突处理与负载因子", optional: false },
    ],
  },
  {
    name: "核心结构",
    nodes: [
      { title: "二叉树遍历", description: "前中后序与层序的递归迭代写法", optional: false },
      { title: "排序算法", description: "比较排序家族与稳定性", optional: false },
      { title: "二分查找", description: "边界写法与常见变形", optional: true },
      { title: "堆与优先队列", description: "堆序性质与 Top-K 套路", optional: false },
      { title: "图的表示", description: "邻接表、矩阵与遍历框架", optional: false },
    ],
  },
  {
    name: "进阶专题",
    nodes: [
      { title: "动态规划入门", description: "状态、转移与初始化三板斧", optional: false },
      { title: "回溯与剪枝", description: "排列组合子集的搜索框架", optional: false },
      { title: "字符串匹配", description: "双指针与滑动窗口应用", optional: false },
      { title: "手写代码训练", description: "白板无提示的限时编码练习", optional: false },
      { title: "并查集", description: "连通性判定与路径压缩", optional: false },
    ],
  },
  {
    name: "面试实战",
    nodes: [
      { title: "高频题精练", description: "按题型分类的真题串讲", optional: false },
      { title: "模拟面试复盘", description: "限时模拟与错因归纳", optional: false },
    ],
  },
];

const STUB_PROPOSAL_EDGES = [
  // 12 valid forward pairs (the rendered roadmap's arrows; 4/5/5/2 nodes
  // across the four stages — stage indices verified per pair below).
  ["复杂度分析", "二叉树遍历"], // S1→S2
  ["数组与链表", "排序算法"], // S1→S2
  ["数组与链表", "二分查找"], // S1→S2
  ["栈与队列", "堆与优先队列"], // S1→S2
  ["哈希表原理", "图的表示"], // S1→S2
  ["排序算法", "动态规划入门"], // S2→S3
  ["二叉树遍历", "回溯与剪枝"], // S2→S3
  ["二分查找", "字符串匹配"], // S2→S3
  ["堆与优先队列", "手写代码训练"], // S2→S3
  ["图的表示", "并查集"], // S2→S3
  ["动态规划入门", "高频题精练"], // S3→S4
  ["手写代码训练", "模拟面试复盘"], // S3→S4
  // Two SAME-STAGE pairs — the spine era (epic-28 feedback round): cross-stage
  // pairs are withheld from the rendering (the spine carries inter-stage
  // ordering), so these are the only two that draw brackets.
  ["排序算法", "堆与优先队列"], // S2→S2
  ["高频题精练", "模拟面试复盘"], // S4→S4
  // The one invalid pair: backward (S4 → S1) — the server drops it.
  ["模拟面试复盘", "复杂度分析"],
];

function proposalReply(text) {
  // epic-27: the prompt carries one free-form message; the stub derives the
  // plan's short topic from it (the real model's "short title" job).
  // Files-only rounds (2026-11-10) carry the materials-without-message line
  // instead — same stub plan, honest "Stub plan" topic.
  const message = text.split("The learner's message:")[1]?.split("\n")[0]?.trim() ?? "";
  const topic = message.length > 0 ? message.slice(0, 40) : "Stub plan";
  const outline = [
    "<outline>",
    ...STUB_PROPOSAL_STAGES.map((stage, index) => {
      const titles = stage.nodes
        .map((node) => (node.optional ? `${node.title}（可选）` : node.title))
        .join("、");
      return `第 ${index + 1} 阶段 ${stage.name}：${titles}`;
    }),
    "</outline>",
  ];
  const proposal = { topic, stages: STUB_PROPOSAL_STAGES, edges: STUB_PROPOSAL_EDGES };
  return [...outline, "<proposal>", JSON.stringify(proposal), "</proposal>"].join("\n");
}

/**
 * The mapping reply: {"mappings":[{sectionId, nodeId, proposedNodeTitle}]}
 * — one entry per real `[section id=…]` regexed out of the assembled
 * mapping context, all pointing at the FIRST `[node id=…]` there (the stub
 * proposal's first node, 复杂度分析). The backend's normalize_targets drops
 * anything unusable, so a missed id costs a section its proposal, not the
 * contract.
 */
function mappingReply(text) {
  const sectionIds = [...text.matchAll(/\[section id=(.+?)[\]\s]/g)].map((match) => match[1]);
  const nodeId = (text.match(/\[node id=(.+?)[\]\s]/) ?? [])[1];
  if (sectionIds.length === 0 || !nodeId) {
    return "Stub could not find section/node ids in the mapping context.";
  }
  return JSON.stringify({
    mappings: sectionIds.map((sectionId) => ({ sectionId, nodeId, proposedNodeTitle: null })),
  });
}

/**
 * The lesson outline reply (epic-36 T3 — the ① propose gate AND ②'s internal
 * outline call share the `Prompts.lesson_outline` shape): {"chapters":[…]}
 * — the real `[section id=…]` values regexed out of the assembled context,
 * split deterministically into TWO chapters (a head chapter and a tail
 * chapter; a single-section context collapses honestly to one chapter with
 * that section). The server's outline normalizer drops chapters citing ids
 * the context does not carry, so fabrication would fail loudly, not silently.
 */
function lessonOutlineReply(text) {
  const sectionIds = [...text.matchAll(/\[section id=(.+?)[\]\s]/g)].map((match) => match[1]);
  if (sectionIds.length === 0) {
    return "Stub could not find section ids in the lesson outline context.";
  }
  const unique = [...new Set(sectionIds)];
  const split = Math.ceil(unique.length / 2);
  const chapters = [{ title: "基础梳理", sourceSectionIds: unique.slice(0, split) }];
  if (unique.length > split) {
    chapters.push({ title: "要点深化", sourceSectionIds: unique.slice(split) });
  }
  return JSON.stringify({ chapters });
}

/**
 * The lesson section fill reply (epic-36 T3 — the stream op's per-chapter
 * `Prompts.lesson_section` shape): the chapter Markdown itself, opening with
 * the level-2 heading the prompt asks for and closing with the recap line —
 * the chapter title is regexed out of the prompt (the server echoes it into
 * the outline status flip, so a missed match would still land a usable
 * body, just generically titled).
 */
function lessonSectionReply(text) {
  const chapterTitle = (text.match(/writing the chapter "(.+?)" of/) ?? [])[1] ?? "本章";
  return [
    `## ${chapterTitle}`,
    "",
    "本小节是对来源材料对应小节的重新组织：stub 确定性内容，用于验证讲义生成链路的端到端行为。",
    "",
    "- 要点一：讲义严格来自学习者上传的材料，不做无依据的展开。",
    "- 要点二：每小节完成后立即落盘，断线重开只补缺失部分。",
    "",
    "小结：本小节覆盖了来源小节的核心内容，可通过来源行跳回原文核对。",
  ].join("\n");
}

function replyFor(messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const text = lastUser?.content ?? "";

  if (text.startsWith("Design a study plan.")) return proposalReply(text);
  if (text.includes("quiz questions")) return quizReply(text);
  // Section mapping (epic P2-10's AI map run — epic-34 T3 makes it
  // auto-fired, so the creation-with-file flow hits it unprompted): the
  // mapping prompt's stable instruction line is the contract matched here.
  // Every real section id rides out pointing at the plan's FIRST node — the
  // server normalizes (unknown sections dropped, hallucinated node ids would
  // land Unmapped), so fabrication would fail loudly, not silently.
  if (text.includes("Map EVERY [section id=")) return mappingReply(text);
  // Lesson outline (epic-36): the stable instruction line of
  // Prompts.lesson_outline — JSON chapters citing real section ids.
  if (text.includes("Propose a chapter outline for an AI-generated study lesson")) {
    return lessonOutlineReply(text);
  }
  // Lesson section fill (epic-36): the per-chapter Markdown request —
  // matched on the lesson-writing sentence no other prompt carries.
  if (text.includes("of the generated study lesson")) return lessonSectionReply(text);
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
