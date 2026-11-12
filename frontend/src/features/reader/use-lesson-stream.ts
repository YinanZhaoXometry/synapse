/**
 * The lesson stream controller (epic-36 T2): the reader-side hook over the
 * `lesson` SSE op (the generated-lesson section fill). The SERVER is the
 * progress truth — every section persists atomically before its
 * section_ready event, so this hook only (a) carries the live streaming
 * fragment for the ACTIVE placeholder and (b) drives the material refetch on
 * the server-side landing events (outline_ready / section_ready / terminal).
 * The ticket payload is the lesson id alone (the row's outline + resume
 * semantics live server-side); `start(regenerate)` carries the reader's
 * 「重新生成」 in-place replace. One session per read — a second start while
 * streaming is a no-op; unmount cancels (startStream also registers the
 * resetApiClient terminator — a logout kills it independently).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { startStream, type StreamSession } from "@/ai/sse-client";
import { useLanguage } from "@/contexts/LanguageContext";

export function useLessonStream(
  lessonId: string,
  options: {
    /** The material read's sweep — the render truth every server-side landing
     * rides in on (outline placeholders, section rows, pausedKind). */
    refetchMaterial: () => Promise<unknown>;
    /** A non-OK terminal's code (the page toasts it through the closed enum). */
    onTerminal?: (code: string) => void;
  },
) {
  const { language, t } = useLanguage();
  const [streaming, setStreaming] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState<string | null>(null);
  const sessionRef = useRef<StreamSession | null>(null);
  // The options ride a ref: `start` stays stable per (lessonId, language) and
  // the callbacks always read the LIVE ones (the refetch identity changes as
  // the page re-renders — the handlers must never go stale).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  useEffect(
    () => () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    },
    [],
  );

  const start = useCallback(
    (regenerate = false) => {
      if (sessionRef.current) return; // one session per read — the banner's actions gate on it
      setStreaming(true);
      setActiveSectionId(null);
      setStreamText(null);
      sessionRef.current = startStream(
        {
          op: "lesson",
          lessonId,
          language,
          ...(regenerate ? { regenerate: true } : {}),
        },
        {
          onOutlineReady: () => {
            void optionsRef.current.refetchMaterial();
          },
          onSectionStart: (event) => {
            setActiveSectionId(event.sectionId);
            setStreamText("");
          },
          onToken: (text) => {
            setStreamText((prev) => (prev ?? "") + text);
          },
          onSectionReady: (sectionId) => {
            setActiveSectionId((prev) => (prev === sectionId ? null : prev));
            setStreamText(null);
            void optionsRef.current.refetchMaterial();
          },
          // AD-16: a drop restarted on a FRESH ticket — the redeem counted
          // against the daily cap (never silent; the stream itself continues
          // server-side, ready sections skip).
          onRestart: (notice) => {
            toast.info(t(notice.messageKey));
          },
          onTerminal: (terminal) => {
            sessionRef.current = null;
            setStreaming(false);
            setActiveSectionId(null);
            setStreamText(null);
            void optionsRef.current.refetchMaterial();
            if (terminal.code !== "OK") optionsRef.current.onTerminal?.(terminal.code);
          },
        },
      );
    },
    [lessonId, language, t],
  );

  const stop = useCallback(() => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setStreaming(false);
    setActiveSectionId(null);
    setStreamText(null);
  }, []);

  return { start, stop, streaming, activeSectionId, streamText };
}
