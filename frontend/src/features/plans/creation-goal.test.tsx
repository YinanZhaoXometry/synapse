/**
 * The creation chat's goal selection plumb-through (epic P2-8 T5 · A3/FR-1):
 * the four named goals are GENERATION INPUTS — the selected canonical value
 * feeds the proposal stream's `goal` param (and, through the same
 * lastInput.goal as free text, the createPlan input). The free-text goal
 * input stays the optional override: typed text wins over a picked chip. The
 * transcript renders the named goal in the UI language, never the raw id.
 *
 * The seam is the observable: the driver hands the goal to
 * CompanionService.generatePlanStructure (the double under vitest, spied) —
 * no raw Apollo AI call anywhere near the surface (AD-5).
 */
import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
          {/* mounted so the restart-notice toast is an observable state */}
          <Toaster />
        </LanguageProvider>
      </MockedProvider>
    </MemoryRouter>,
  );
}

/** Type the topic and send — the chat streams (the spied seam resolves).
 * Expected copy reads the dictionary directly (independent source). */
async function sendTopic(topic: string) {
  fireEvent.change(screen.getByPlaceholderText(zhDict["plans.topicPlaceholder"]), { target: { value: topic } });
  fireEvent.click(screen.getByRole("button", { name: zhDict["plans.send"] }));
  await waitFor(() => expect(screen.getByText("阶段一：基础")).toBeInTheDocument());
}

describe("CreationChat goal selection (T5 · A3/FR-1)", () => {
  let generateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    generateSpy = vi.spyOn(getCompanionService(), "generatePlanStructure").mockResolvedValue(proposal);
    localStorage.clear();
  });

  it("a picked named goal feeds the proposal stream's goal param (canonical value on the wire)", async () => {
    renderChat();
    fireEvent.click(screen.getByTestId("creation-goal-exam-prep"));
    await sendTopic("软件工程");

    expect(generateSpy).toHaveBeenCalledWith("软件工程", "zh", expect.any(Function), "exam-prep", { onNotice: expect.any(Function) });
    // the transcript renders the named goal in the UI language, not the id
    expect(screen.getByText(/备考冲刺/)).toBeInTheDocument();
  });

  it("typed goal text overrides the picked chip (the input stays the honest override)", async () => {
    renderChat();
    fireEvent.click(screen.getByTestId("creation-goal-deep-understanding"));
    fireEvent.change(screen.getByPlaceholderText(zhDict["plans.goalPlaceholder"]), { target: { value: "为了期末的第三章" } });
    await sendTopic("软件工程");

    expect(generateSpy).toHaveBeenCalledWith("软件工程", "zh", expect.any(Function), "为了期末的第三章", { onNotice: expect.any(Function) });
    expect(screen.getByText(/为了期末的第三章/)).toBeInTheDocument();
  });

  it("no chip, no text → the goal param stays null (the free-text era behavior)", async () => {
    renderChat();
    await sendTopic("软件工程");

    expect(generateSpy).toHaveBeenCalledWith("软件工程", "zh", expect.any(Function), null, { onNotice: expect.any(Function) });
  });

  it("clicking a picked chip deselects it (the toggle stays honest)", async () => {
    renderChat();
    const chip = screen.getByTestId("creation-goal-revision");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-checked")).toBe("false");

    await sendTopic("软件工程");
    expect(generateSpy).toHaveBeenCalledWith("软件工程", "zh", expect.any(Function), null, { onNotice: expect.any(Function) });
  });

  it("a restart notice surfaces as the cap-counted toast (US2: the drop is never silent)", async () => {
    // the double replays what the real adapter does on a drop: fire the
    // notice channel with the t() key, then keep streaming to a proposal
    generateSpy.mockImplementation(
      (_topic: unknown, _language: unknown, _onToken: unknown, _goal: unknown, options?: { onNotice?: (key: string) => void }) => {
        options?.onNotice?.("ai.stream.connectionLost");
        return Promise.resolve(proposal);
      },
    );
    renderChat();
    await sendTopic("软件工程");

    // the toast is an observable state — sonner renders it asynchronously
    expect(await screen.findByText(zhDict["ai.stream.connectionLost"])).toBeInTheDocument();
  });
});
