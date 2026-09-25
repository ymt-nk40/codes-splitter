import { useEffect } from "react";
import { useStudioStore } from "@/store/studio-store";
import { DesktopShell } from "./desktop-shell";
import { MobileShell } from "./mobile-shell";

export function StudioApp() {
  const theme = useStudioStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <>
      <div className="hidden h-dvh min-h-0 min-w-0 flex-col overflow-hidden md:flex">
        <DesktopShell />
      </div>
      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden md:hidden">
        <MobileShell />
      </div>
    </>
  );
}
