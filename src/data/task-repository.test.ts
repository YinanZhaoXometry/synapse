import { beforeEach, describe, expect, it } from "vitest";
import type { ReadingPosition } from "@/domain/entities";
import { loadDb } from "./store";
import { createStudyTask, getTask, listTasks } from "./task-repository";
import {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  isOnboardingComplete,
  markOnboardingComplete,
  saveReadingProgress,
} from "./progress-repository";
import { registerMaterial } from "./material-repository";

beforeEach(() => {
  localStorage.clear();
});

const position: ReadingPosition = {
  locator: { kind: "markdown", sectionId: "intro" },
  text: "# Intro — section text",
};

describe("study task (AD-6: task owns exactly one auto-created node)", () => {
  it("creates a task with its single owned node and links the material", () => {
    const { material } = registerMaterial({
      title: "paper.pdf",
      kind: "pdf",
      sizeBytes: 10,
      planId: null,
      taskId: null,
      sections: [{ id: "page-1", title: "P1", text: "text" }],
    });

    const { task, node } = createStudyTask({ materialId: material.id });
    expect(getTask(task.id)?.materialId).toBe(material.id);
    expect(node.taskId).toBe(task.id);
    expect(node.planId).toBeNull(); // no plan — the task's node stands alone
    expect(node.title).toBe(material.title);

    // exactly ONE node owned by the task
    const owned = loadDb().nodes.filter((n) => n.taskId === task.id);
    expect(owned).toHaveLength(1);

    // the material is now attached to the task
    expect(material.taskId).toBe(null); // registration predates the task
    const relinked = loadDb().materials.find((m) => m.id === material.id);
    expect(relinked?.taskId).toBe(task.id);

    expect(listTasks()).toHaveLength(1);
  });
});

describe("reading progress + chat threads + onboarding flag", () => {
  it("reading progress round-trips and overwrites per material", () => {
    registerMaterial({
      title: "doc.md",
      kind: "markdown",
      sizeBytes: 1,
      planId: null,
      taskId: null,
      sections: [],
    });
    const materialId = loadDb().materials[0].id;

    saveReadingProgress(materialId, position);
    const later: ReadingPosition = { locator: { kind: "markdown", sectionId: "methods" }, text: "..." };
    saveReadingProgress(materialId, later);

    expect(getReadingProgress(materialId)?.position.locator).toEqual(later.locator);
  });

  it("chat thread anchors to its material and round-trips across a reload", () => {
    registerMaterial({
      title: "doc.md",
      kind: "markdown",
      sizeBytes: 1,
      planId: null,
      taskId: null,
      sections: [],
    });
    const materialId = loadDb().materials[0].id;

    appendChatMessage(materialId, {
      role: "user",
      text: "这一页在讲什么？",
      citations: [],
    });
    appendChatMessage(materialId, {
      role: "companion",
      text: "这一页介绍集成测试。",
      citations: [{ kind: "markdown", sectionId: "intro" }],
    });

    const thread = getChatThread(materialId);
    expect(thread?.materialId).toBe(materialId);
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[1].citations[0]).toEqual({ kind: "markdown", sectionId: "intro" });
  });

  it("onboarding-complete flag round-trips as a field of the document", () => {
    expect(isOnboardingComplete()).toBe(false);
    markOnboardingComplete();
    expect(isOnboardingComplete()).toBe(true);
    expect(loadDb().onboardingComplete).toBe(true);
  });
});
