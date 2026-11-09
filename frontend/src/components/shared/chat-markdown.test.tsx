import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatMarkdown from "./chat-markdown";

/**
 * ChatMarkdown (epic-26 T1): GFM markdown renders as elements inside the
 * .chat-prose wrapper — bold, GFM tables, fenced code, and plain-text
 * passthrough with softbreaks preserved (the old pre-wrap line-break look).
 */

describe("ChatMarkdown", () => {
  it("renders bold inline markdown as <strong>", () => {
    const { container } = render(<ChatMarkdown text={"**重点**内容"} />);
    expect(container.querySelector("strong")?.textContent).toBe("重点");
    expect(container.querySelector(".chat-prose")).not.toBeNull();
  });

  it("renders a GFM table with th/td cells", () => {
    const { container } = render(
      <ChatMarkdown text={"| 概念 | 含义 |\n| --- | --- |\n| ADR | 决策记录 |"} />,
    );
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("th")?.textContent).toBe("概念");
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });

  it("renders a fenced code block (and does not treat it as inline code)", () => {
    const { container } = render(<ChatMarkdown text={"看代码：\n\n```py\nprint(1)\n```"} />);
    expect(container.querySelector("pre code")).not.toBeNull();
    expect(container.querySelector("pre")?.textContent).toContain("print(1)");
  });

  it("keeps single-newline softbreaks as line breaks (pre-wrap paragraphs)", () => {
    const { container } = render(<ChatMarkdown text={"第一行\n第二行"} />);
    const p = container.querySelector("p")!;
    expect(p.textContent).toContain("第一行");
    expect(p.textContent).toContain("第二行");
    // The softbreak survives as a literal newline text node — .chat-prose p's
    // pre-wrap renders it as a break, matching the old whitespace-pre-wrap look.
    expect(p.textContent).toMatch(/第一行\s*\n\s*第二行/);
  });

  it("renders a bare string with no markdown as plain paragraph text", () => {
    const { container } = render(<ChatMarkdown text={"普通一句话"} />);
    expect(container.querySelector("p")?.textContent).toBe("普通一句话");
    expect(container.querySelector("strong")).toBeNull();
  });
});
