import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { NamingConvention, SplitMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";

const MODES: { id: SplitMode; label: string; hint: string }[] = [
  { id: "minimal", label: "Minimal", hint: "A few large modules" },
  { id: "balanced", label: "Balanced", hint: "Group by concern" },
  { id: "maximum", label: "Maximum", hint: "One unit per file" },
];

function ModePicker() {
  const mode = useStudioStore((s) => s.settings.mode);
  const updateSettings = useStudioStore((s) => s.updateSettings);
  return (
    <div role="radiogroup" aria-label="Split mode" className="grid grid-cols-3 gap-1.5">
      {MODES.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => updateSettings({ mode: item.id })}
            className={cn(
              "flex min-h-11 flex-col items-start justify-center rounded-lg border px-2 py-1.5 text-left transition-colors",
              active
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border bg-background-muted text-foreground-muted hover:text-foreground",
            )}
          >
            <span className="text-xs font-semibold">{item.label}</span>
            <span className="hidden text-xs leading-tight md:block">{item.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function AdvancedFields() {
  const settings = useStudioStore((s) => s.settings);
  const updateSettings = useStudioStore((s) => s.updateSettings);
  const rows: { key: keyof typeof settings; label: string; hint: string }[] = [
    { key: "preserveComments", label: "Preserve comments", hint: "Keep origin markers" },
    { key: "generateBarrel", label: "Barrel index", hint: "Re-export from src/index" },
    { key: "generateReadme", label: "Generate README", hint: "Project layout notes" },
    { key: "generateTests", label: "Test stubs", hint: "Describe/it scaffolds" },
    { key: "includeTypesFile", label: "Types file", hint: "Extract interfaces" },
    { key: "folderByKind", label: "Kind folders", hint: "types/, classes/, …" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.key} className="flex min-h-11 items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor={row.key} className="text-foreground">
              {row.label}
            </Label>
            <p className="text-xs text-foreground-muted">{row.hint}</p>
          </div>
          <Switch
            id={row.key}
            checked={Boolean(settings[row.key])}
            onCheckedChange={(checked) => updateSettings({ [row.key]: checked })}
            aria-label={row.label}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="max-lines">Max file lines</Label>
          <span className="font-mono text-xs tabular-nums text-foreground">{settings.maxFileLines}</span>
        </div>
        <Slider
          id="max-lines"
          min={40}
          max={400}
          step={10}
          value={[settings.maxFileLines]}
          onValueChange={([value]) => updateSettings({ maxFileLines: value ?? 160 })}
          aria-label="Maximum file lines"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="naming">Naming convention</Label>
        <Select
          value={settings.naming}
          onValueChange={(value) => updateSettings({ naming: value as NamingConvention })}
        >
          <SelectTrigger id="naming" aria-label="Naming convention">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kebab">kebab-case</SelectItem>
            <SelectItem value="camel">camelCase</SelectItem>
            <SelectItem value="pascal">PascalCase</SelectItem>
            <SelectItem value="snake">snake_case</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function SplitControls({ compact = false }: { compact?: boolean }) {
  const resplit = useStudioStore((s) => s.resplit);
  return (
    <div className="flex flex-col gap-3">
      <ModePicker />
      {compact ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced" className="border-border">
            <AccordionTrigger>Advanced settings</AccordionTrigger>
            <AccordionContent>
              <AdvancedFields />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <div className="rounded-lg border border-border-muted bg-background-muted p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-foreground-muted uppercase">Advanced settings</p>
          <AdvancedFields />
        </div>
      )}
      <Button type="button" className="h-11 w-full md:h-9" onClick={resplit}>
        Re-split source
      </Button>
    </div>
  );
}
