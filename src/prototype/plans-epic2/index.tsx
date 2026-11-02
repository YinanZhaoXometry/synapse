/**
 * PROTOTYPE — epic-2 Study Plans UI. Three structural variants of the plan-first
 * front door + Plan Home, mounted on the existing /planner route (real sidebar,
 * real theme/tokens), switchable via ?variant=A|B|C and the floating bottom bar.
 *
 * Question: what should the plans front door look like? (grill Q3/Q4/Q5/Q7 inputs)
 * Throwaway: stub data, no persistence, no real mutations, inline zh/en strings
 * (the real build goes through the i18n table). Scores come from the real domain
 * fns; plan generation uses the real (simulated) CompanionService — read-only.
 */
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import VariantA from "./VariantA";
import VariantB from "./VariantB";
import VariantC from "./VariantC";
import { PrototypeSwitcher, type VariantDef } from "./PrototypeSwitcher";

const VARIANTS: VariantDef[] = [
  { key: "A", label: "Spine 基线" },
  { key: "B", label: "对话即门面" },
  { key: "C", label: "编辑部时间线" },
];

export default function PlannerPrototype() {
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = searchParams.get("variant") || "A";

  const cycle = useCallback(
    (dir: -1 | 1) => {
      const idx = VARIANTS.findIndex(v => v.key === variant);
      const next = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length];
      if (next.key === "A") setSearchParams({}, { replace: true });
      else setSearchParams({ variant: next.key }, { replace: true });
    },
    [searchParams, setSearchParams, variant]
  );

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {/* DEV-only guard so a stray merge can't ship the bar */}
      {import.meta.env.DEV && <PrototypeSwitcher variants={VARIANTS} current={variant} onCycle={cycle} />}
    </>
  );
}
