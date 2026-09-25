import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/store/studio-store";
import type { ThemeName } from "@/lib/types";

const LABEL: Record<ThemeName, string> = {
  dark: "Dark theme",
  light: "Light theme",
  brand: "Brand theme",
};

export function ThemeToggle({ size = "icon" }: { size?: "icon" | "icon-lg" }) {
  const theme = useStudioStore((s) => s.theme);
  const cycleTheme = useStudioStore((s) => s.cycleTheme);
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={cycleTheme}
      aria-label={`${LABEL[theme]}. Switch theme`}
      title={LABEL[theme]}
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <Sun
          className={`absolute size-4 transition-[opacity,transform,filter] duration-200 ${theme === "light" ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"}`}
        />
        <Moon
          className={`absolute size-4 transition-[opacity,transform,filter] duration-200 ${theme === "dark" ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"}`}
        />
        <Monitor
          className={`absolute size-4 transition-[opacity,transform,filter] duration-200 ${theme === "brand" ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"}`}
        />
      </span>
    </Button>
  );
}
