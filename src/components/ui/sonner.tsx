import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-background-muted text-foreground border-border shadow-[var(--shadow-border)]",
          title: "text-foreground",
          description: "text-foreground-muted",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-surface text-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
