/**
 * useLessonStream (epic-36 T2): the reader-side controller over the lesson
 * SSE op. The tests pin the CONTRACT, not the stream machinery (that is
 * sse-client.test's): the mint request shape (lessonId + language inside,
 * regenerate riding only when the caller asks), the event → state/refetch
 * wiring (outline_ready/section_ready sweep the material read; tokens
 * accumulate into the active section's streaming text; the terminal ends
 * the stream and surfaces its code), and the teardown discipline (unmount
 * cancels; a second start is a no-op). startStream is mocked — its real
 * behavior is green in sse-client.test.ts.
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useLessonStream } from "./use-lesson-stream";

const startStream = vi.fn();
vi.mock("@/ai/sse-client", () => ({
  startStream: (...args: unknown[]) => startStream(...args),
}));

interface CapturedSession {
  request: Record<string, unknown>;
  handlers: Record<string, ((...args: unknown[]) => void) | undefined>;
  cancel: ReturnType<typeof vi.fn>;
}

/** The fake session startStream returns; each call records request+handlers. */
const sessions: CapturedSession[] = [];

function fakeStartStream(request: Record<string, unknown>, handlers: Record<string, ((...args: unknown[]) => void) | undefined> = {}) {
  const session: CapturedSession = {
    request,
    handlers,
    cancel: vi.fn(),
  };
  sessions.push(session);
  return { cancel: session.cancel, done: Promise.resolve(null) };
}

const refetch = vi.fn().mockResolvedValue(undefined);
const onTerminal = vi.fn();

let latest: ReturnType<typeof useLessonStream> | null = null;

function Harness({ lessonId }: { lessonId: string }) {
  const handle = useLessonStream(lessonId, { refetchMaterial: refetch, onTerminal });
  latest = handle;
  return (
    <div>
      <button type="button" data-testid="start" onClick={() => handle.start()} />
      <button type="button" data-testid="regenerate" onClick={() => handle.start(true)} />
    </div>
  );
}

function mountHarness(lessonId = "lesson-1") {
  return render(
    <LanguageProvider>
      <Harness lessonId={lessonId} />
    </LanguageProvider>,
  );
}

/** Mount + click start; returns the render view AND the captured session. */
async function startedHarness() {
  const view = mountHarness();
  await userEvent.click(screen.getByTestId("start"));
  return { view, session: sessions[0] };
}

beforeEach(() => {
  sessions.length = 0;
  startStream.mockReset();
  startStream.mockImplementation(fakeStartStream as never);
  refetch.mockClear();
  onTerminal.mockClear();
  latest = null;
});

describe("useLessonStream (epic-36 T2)", () => {
  it("start mints the lesson stream — lessonId + language inside, regenerate rides only when asked", async () => {
    const first = await startedHarness();
    expect(startStream).toHaveBeenCalledTimes(1);
    expect(first.session.request).toEqual({ op: "lesson", lessonId: "lesson-1", language: "zh" });
    expect(latest?.streaming).toBe(true);
    // The first session ENDS (terminal), then a fresh start carries the flag —
    // the same session gate the reader's banner actions sit behind.
    act(() => first.session.handlers.onTerminal?.({ code: "OK" }));

    await userEvent.click(screen.getByTestId("regenerate"));
    expect(startStream).toHaveBeenCalledTimes(2);
    expect(sessions[1].request).toEqual({ op: "lesson", lessonId: "lesson-1", language: "zh", regenerate: true });
    first.view.unmount();
  });

  it("outline_ready sweeps the material read (the placeholders are server-persisted before the event)", async () => {
    const view = await startedHarness();
    act(() => view.session.handlers.onOutlineReady?.([]));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("section_start marks the active placeholder; tokens stream into it; section_ready clears + refetches", async () => {
    const view = await startedHarness();
    act(() => view.session.handlers.onSectionStart?.({ sectionId: "ch-2", title: "链式复制" }));
    expect(latest?.activeSectionId).toBe("ch-2");

    act(() => view.session.handlers.onToken?.("链式"));
    act(() => view.session.handlers.onToken?.("复制"));
    expect(latest?.streamText).toBe("链式复制");

    act(() => view.session.handlers.onSectionReady?.("ch-2"));
    expect(latest?.activeSectionId).toBeNull();
    expect(latest?.streamText).toBeNull();
    expect(refetch).toHaveBeenCalledTimes(1); // the sweep IS the section's render truth
  });

  it("the terminal ends the stream, sweeps the read, and surfaces the code (CAP_REACHED included)", async () => {
    const view = await startedHarness();
    act(() => view.session.handlers.onSectionStart?.({ sectionId: "ch-1", title: "选举与日志" }));
    act(() => view.session.handlers.onTerminal?.({ code: "CAP_REACHED", error: new Error("x") }));

    expect(latest?.streaming).toBe(false);
    expect(latest?.activeSectionId).toBeNull();
    expect(latest?.streamText).toBeNull();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledExactlyOnceWith("CAP_REACHED");
  });

  it("a second start while streaming is a no-op — one session per lesson read", async () => {
    await startedHarness();
    act(() => latest?.start());
    act(() => latest?.start(true));

    expect(startStream).toHaveBeenCalledTimes(1);
  });

  it("unmount cancels the live session — nothing survives the reader", async () => {
    const harness = await startedHarness();
    harness.view.unmount();

    expect(sessions[0].cancel).toHaveBeenCalledTimes(1);
  });
});
