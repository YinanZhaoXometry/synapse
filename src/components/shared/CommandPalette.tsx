import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navGroups } from "@/components/layout/nav-items";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Northstar ⌘K command bar (docs/design/northstar-import/IMPORT.md §1):
// global ⌘K/Ctrl+K opens a palette with page navigation + language toggle.
export function CommandPalette({ open, onOpenChange }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.noResults")}</CommandEmpty>
        {navGroups.map(group => (
          <CommandGroup
            key={group.labelKey ?? "settings"}
            heading={group.labelKey ? t(group.labelKey) : undefined}
          >
            {group.items.map(item => (
              <CommandItem
                key={item.to}
                value={t(item.labelKey)}
                onSelect={() => run(() => navigate(item.to))}
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {t(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading={t("command.groupActions")}>
          <CommandItem
            value={t("command.toggleLanguage")}
            onSelect={() => run(() => setLanguage(language === "zh" ? "en" : "zh"))}
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            {t("command.toggleLanguage")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
