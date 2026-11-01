import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { Send, Sparkles, User, Lightbulb, BookOpen, HelpCircle, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const mockResponses: Record<string, Record<string, string>> = {
  zh: {
    default: "很高兴能帮助你学习！我可以用不同层次来解释概念、生成练习题、总结笔记，或帮助你理解错误。你想从哪里开始？",
    explain: "让我一步步来解释。\n\n**核心概念：**在人机交互中，**可供性（affordance）**是物体的属性，暗示了它可以如何被使用。例如，按钮暗示点击，把手暗示拉动。\n\n**Norman 的设计原则：**\n1. **可见性** — 让用户知道可以做什么\n2. **反馈** — 对每个操作给出即时反馈\n3. **约束** — 限制可能的操作以防止错误\n4. **映射** — 建立控件和结果之间的自然关系\n\n先想想身边有哪些例子，需要我再讲或考考你吗？",
    quiz: "来测试一下：\n\n**问题：**以下哪项最好地描述了 HCI 中的「可供性」？\n\nA) 按钮的视觉外观\nB) 物体暗示其使用方式的属性\nC) 用户完成任务的速度\nD) 达到目标所需的点击次数\n\n先想好你的答案，再告诉我。",
    summarize: "以下是你上传资料中的关键主题摘要：\n\n- **可用性启发式** — Nielsen 的界面设计十大原则\n- **以用户为中心的设计** — 聚焦用户需求的迭代过程\n- **认知负荷理论** — 管理界面设计中的心理负担\n- **可访问性** — WCAG 指南与包容性设计\n- **交互模式** — 常见 UI 模式及其使用场景\n\n需要我深入讲解其中某个主题吗？",
    mistake: "让我帮你理解哪里出了问题。\n\n**你的答案：**「可供性是关于视觉设计的」\n\n**为什么不太对：**虽然视觉设计可以*暗示*可供性，但可供性本身是关于物体和用户之间的*功能关系*。无论颜色如何，门把手都暗示拉动。\n\n**正确理解：**可供性是物体属性和使用者能力之间的关系，无论是否被感知到，它都存在。\n\n**提示：**把可供性理解为你*能用*它做什么，而不是它*看起来*像什么。\n\n要不要做个练习题来巩固一下？",
  },
  en: {
    default: "Happy to help you learn! I can explain concepts at different levels, generate practice questions, summarize notes, or help you understand mistakes. Where would you like to start?",
    explain: "Let me explain step by step.\n\n**Core Concept:** In HCI, **affordance** is a property of an object that suggests how it can be used. For example, buttons suggest clicking, handles suggest pulling.\n\n**Norman's Design Principles:**\n1. **Visibility** — Let users know what's possible\n2. **Feedback** — Immediate response to every action\n3. **Constraints** — Limit actions to prevent errors\n4. **Mapping** — Natural relationship between controls and outcomes\n\nTry thinking of examples around you first — want more, or shall I quiz you?",
    quiz: "Let's test your knowledge:\n\n**Question:** Which best describes 'affordance' in HCI?\n\nA) The visual appearance of a button\nB) A property that suggests how an object can be used\nC) How fast a user completes a task\nD) The number of clicks to reach a goal\n\nSettle on your answer first, then tell me.",
    summarize: "Here's a summary of key themes from your uploaded materials:\n\n- **Usability Heuristics** — Nielsen's 10 principles for interface design\n- **User-Centered Design** — Iterative process focused on user needs\n- **Cognitive Load Theory** — Managing mental effort in interface design\n- **Accessibility** — WCAG guidelines & inclusive design\n- **Interaction Patterns** — Common UI patterns and their applications\n\nWant me to dive deeper into any topic?",
    mistake: "Let me help you understand what went wrong.\n\n**Your answer:** 'Affordance is about visual design'\n\n**Why it's not quite right:** While visual design can *suggest* affordance, affordance itself is about the *functional relationship* between an object and a user. A door handle affords pulling regardless of color.\n\n**Correct understanding:** Affordance is the relationship between object properties and user capabilities — it exists whether perceived or not.\n\n**Tip:** Think of affordance as what you *can do* with it, not what it *looks like*.\n\nWant to try a practice question to reinforce this?",
  },
};

export default function AITutorPage() {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { icon: Lightbulb, text: t("tutor.suggest1") },
    { icon: HelpCircle, text: t("tutor.suggest2") },
    { icon: BookOpen, text: t("tutor.suggest3") },
    { icon: Eraser, text: t("tutor.suggest4") },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const lower = msg.toLowerCase();
    let responseKey = "default";
    if (lower.includes("解释") || lower.includes("概念") || lower.includes("explain") || lower.includes("simply")) responseKey = "explain";
    else if (lower.includes("考") || lower.includes("测") || lower.includes("quiz")) responseKey = "quiz";
    else if (lower.includes("总结") || lower.includes("摘要") || lower.includes("summarize") || lower.includes("notes")) responseKey = "summarize";
    else if (lower.includes("错误") || lower.includes("mistake") || lower.includes("wrong")) responseKey = "mistake";

    const responses = mockResponses[language] || mockResponses.zh;
    setTimeout(() => {
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: responses[responseKey], timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm">{t("tutor.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("tutor.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Announce each completed reply once (a11y floor — never per token) */}
        <div className="max-w-3xl mx-auto space-y-4" aria-live="polite">
          {messages.length === 0 && (
            <AnimatedSection>
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-1">{t("tutor.prompt")}</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">{t("tutor.promptDesc")}</p>
                <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSend(s.text)} className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card text-sm text-left hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <s.icon className="w-4 h-4 text-primary shrink-0" />
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          <AnimatePresence>
            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  {msg.role === "assistant" ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4 text-foreground" />}
                </div>
                <div className={cn("max-w-[75%] rounded-2xl px-4 py-3 chat-body", msg.role === "assistant" ? "bg-card border border-border" : "bg-primary text-primary-foreground")}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4" /></div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border bg-card">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("tutor.inputPlaceholder")} aria-label={t("tutor.inputPlaceholder")} className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/20 transition-shadow placeholder:text-muted-foreground" disabled={isTyping} />
            <button type="submit" aria-label={t("tutor.send")} disabled={!input.trim() || isTyping} className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
