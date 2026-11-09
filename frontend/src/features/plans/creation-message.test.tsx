/**
 * CreationChat's epic-27 rework: ONE free-form message + optional staged
 * attachments. The seam is the observable (the goal test's pattern — the
 * double under vitest is spied): the whole message and the files'
 * CLIENT-extracted text (parseFile through the real markdown pipeline —
 * no pdfjs in jsdom, a .md fixture parses honestly) reach
 * generatePlanStructure; the chips stage/remove with the 5-file cap; a
 * parse-failing staged file refuses the send with the honest toast instead
 * of silently sending an empty material.
 */
import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal } from "@/ai/types";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import CreationChat from "./CreationChat";

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const proposal: PlanStructureProposal = {
  topic: "软件工程",
  language: "zh",
  stages: [{ name: "阶段一：基础", nodes: [{ title: "命令层" }] }],
  edges: [],
};

function renderChat() {
  return render(
    <MemoryRouter>
      <MockedProvider>
        <LanguageProvider>
          <CreationChat />
          {/* mounted so toasts (cap / parse failures) are observable states */}
          <Toaster />
        </LanguageProvider>
      </MockedProvider>
    </MemoryRouter>,
  );
}

const composer = () => screen.getByLabelText(zhDict["plans.messagePlaceholder"]) as HTMLTextAreaElement;
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

function stageFiles(files: File[]) {
  const input = fileInput();
  // jsdom has no DataTransfer — the FileList shape the React handler reads is
  // a plain (index-keyed, length-bearing) array assigned onto the input.
  const fileList = Object.assign(files, { length: files.length, item: (i: number) => files[i] });
  Object.defineProperty(input, "files", { value: fileList, configurable: true });
  fireEvent.change(input);
}

const mdFile = (name = "notes.md", text = "# 集成测试\n\n组件之间的交互是重点。") =>
  new File([text], name, { type: "text/markdown" });

describe("CreationChat — one message + attachments (epic-27)", () => {
  let generateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // restore first: re-spying the same singleton keeps the previous mock's
    // call history — each test's assertion reads its OWN call
    vi.restoreAllMocks();
    generateSpy = vi.spyOn(getCompanionService(), "generatePlanStructure").mockResolvedValue(proposal);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the whole free-form message with NO materials (the seam receives the message verbatim)", async () => {
    renderChat();
    fireEvent.change(composer(), { target: { value: "备考 COMP5241，目标 85+" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["plans.send"] }));
    await waitFor(() => expect(screen.getByText("阶段一：基础")).toBeInTheDocument());
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const [message, materials, language] = generateSpy.mock.calls[0];
    expect(message).toBe("备考 COMP5241，目标 85+");
    expect(materials).toEqual([]);
    expect(language).toBe("zh");
  });

  it("stages chips render with a remove affordance; removing clears the stage", async () => {
    const user = userEvent.setup();
    renderChat();
    stageFiles([mdFile()]);
    expect(await screen.findByTestId("creation-staged-files")).toBeInTheDocument();
    expect(screen.getByText("notes")).toBeInTheDocument();

    await user.click(screen.getByTestId("creation-unstage-0"));
    expect(screen.queryByTestId("creation-staged-files")).toBeNull();
  });

  it("a staged markdown file's CLIENT-extracted text rides the seam (AD-7, no server round-trip)", async () => {
    renderChat();
    stageFiles([mdFile("讲义.md", "# 第一章\n\n集成测试关注组件之间的交互。")]);
    await screen.findByTestId("creation-staged-files");

    fireEvent.change(composer(), { target: { value: "按这份讲义备考" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["plans.send"] }));
    await waitFor(() => expect(screen.getByText("阶段一：基础")).toBeInTheDocument());

    const [message, materials] = generateSpy.mock.calls[0];
    expect(message).toBe("按这份讲义备考");
    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({ title: "讲义", kind: "markdown" });
    expect(materials[0].text).toContain("集成测试关注组件之间的交互。");
    // the bound the server command enforces, mirrored client-side
    expect(materials[0].text.length).toBeLessThanOrEqual(20_000);
  });

  it("the 5-file cap refuses the sixth with a bilingual toast", async () => {
    renderChat();
    stageFiles([1, 2, 3, 4, 5].map((i) => mdFile(`a-${i}.md`, "内容")));
    await screen.findByTestId("creation-staged-files");
    expect(screen.getByTestId("creation-staged-files").children).toHaveLength(5);

    stageFiles([mdFile("a-6.md", "内容")]);
    await waitFor(() => {
      expect(document.querySelector("[data-sonner-toast]")).not.toBeNull();
    });
    // the cap held — still exactly the first five
    expect(screen.getByTestId("creation-staged-files").children).toHaveLength(5);
  });

  it("a staged file that parses to nothing refuses the send with the honest toast", async () => {
    renderChat();
    stageFiles([mdFile("empty.md", "   ")]);
    await screen.findByTestId("creation-staged-files");

    fireEvent.change(composer(), { target: { value: "考考我" } });
    fireEvent.click(screen.getByRole("button", { name: zhDict["plans.send"] }));
    await waitFor(() => {
      const toast = document.querySelector("[data-sonner-toast]");
      expect(toast).not.toBeNull();
      // the honest reason: the pipeline's own empty-refusal key
      expect(toast!.textContent).toContain("没有可提取的内容");
    });
    // the send never happened — no seam call, no proposal
    expect(generateSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(zhDict["plans.draftLabel"])).toBeNull();
  });
});
