import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ROUTES, SETTINGS_ROUTE, flatNav, mobileNavPaths } from "./nav-items";

// FR-36 plan-first ordering (epic-7 T3; EXPERIENCE.md line-54 ruling fires —
// the FR-1 front door landed in epic-2): 学习 group leads with 学习计划
// (the front door) first, hubs follow, 总览/进度 trail. The orchestrator's
// pre-decided display order: 学习 (学习计划 → AI 导师 → 学习资料) →
// 练习 (错题本 → 今日学习 → 闪卡 → 测验) → 总览 (仪表盘) → 进度 (成就 →
// 数据分析). 今日学习 returned to the 练习 group when FR-27 landed (epic
// P2-09 T3) — nav-items' own recorded intent — under the label rule
// (zh 今日学习, en Today; 学习计划 stays reserved for Study Plans).
describe("nav-items plan-first ordering (FR-36, epic-7 T3)", () => {
  it("leads the sidebar with the 学习 group whose first item is 学习计划", () => {
    expect(NAV_GROUPS[0].labelKey).toBe("nav.group.learn");
    expect(NAV_GROUPS[0].items[0].labelKey).toBe("nav.plans");
    expect(NAV_GROUPS[0].items[0].to).toBe("/plans");
  });

  it("orders the 学习 group front-door-first: 学习计划 → AI 导师 → 学习资料", () => {
    const learn = NAV_GROUPS.find(g => g.labelKey === "nav.group.learn");
    expect(learn?.items.map(i => i.labelKey)).toEqual(["nav.plans", "nav.tutor", "nav.materials"]);
  });

  it("orders the 练习 hub group per FR-36's listing: 错题本 → 今日学习 → 闪卡 → 测验", () => {
    const practice = NAV_GROUPS.find(g => g.labelKey === "nav.group.practice");
    expect(practice?.items.map(i => i.labelKey)).toEqual(["nav.mistakes", "nav.planner", "nav.flashcards", "nav.quiz"]);
    // Today's hub lives on the retained /planner route under nav.planner —
    // never a 学习计划 alias (the label rule, FR-27).
    expect(practice?.items[1].to).toBe("/planner");
  });

  it("places 总览 and 进度 after the plan-first groups, in order", () => {
    expect(NAV_GROUPS.map(g => g.labelKey)).toEqual([
      "nav.group.learn",
      "nav.group.practice",
      "nav.group.overview",
      "nav.group.progress",
    ]);
    expect(NAV_GROUPS.find(g => g.labelKey === "nav.group.overview")?.items.map(i => i.to)).toEqual(["/dashboard"]);
    expect(NAV_GROUPS.find(g => g.labelKey === "nav.group.progress")?.items.map(i => i.to)).toEqual([
      "/achievements",
      "/analytics",
    ]);
  });

  it("leads the flat nav (⌘K palette) with the front door /plans", () => {
    expect(flatNav[0].to).toBe("/plans");
    expect(flatNav[flatNav.length - 1]).toBe(SETTINGS_ROUTE);
    expect(flatNav.map(i => i.to)).toEqual([
      "/plans",
      "/ai-tutor",
      "/materials",
      "/mistakes",
      "/planner",
      "/flashcards",
      "/quiz",
      "/dashboard",
      "/achievements",
      "/analytics",
      "/settings",
    ]);
  });

  it("keeps the mobile bottom-nav paths fixed (chrome spec'd separately in EXPERIENCE.md)", () => {
    expect(mobileNavPaths).toEqual(["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"]);
  });

  it("keeps the groups structurally sound: every sidebar item is a NAV_ROUTES member, each exactly once", () => {
    const grouped = NAV_GROUPS.flatMap(g => g.items);
    for (const item of grouped) {
      expect(NAV_ROUTES).toContain(item);
    }
    const groupedTos = grouped.map(i => i.to).sort();
    const routeTos = NAV_ROUTES.map(i => i.to).sort();
    expect(groupedTos).toEqual(routeTos);
  });
});
