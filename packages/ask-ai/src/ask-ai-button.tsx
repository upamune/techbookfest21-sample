import { createContext, lazy, Suspense, use, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@pocket/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@pocket/ui/sheet";
import { Skeleton } from "@pocket/ui/skeleton";
import type { AskAiClientTools } from "./tool-definitions";

const AskAiSheet = lazy(() => import("./ask-ai-sheet"));

export type AskAiPage = { tool: string; input: Record<string, unknown> };
export type AskAiSheetProps = {
  page?: AskAiPage;
  suggestions: string[];
  tools: AskAiClientTools;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const AskAiToolsContext = createContext<AskAiClientTools>({ approvalTools: [], display: {} });
export const AskAiToolsProvider = AskAiToolsContext.Provider;

export function AskAiButton({
  page,
  suggestions,
  floating = false,
}: {
  page?: AskAiPage;
  suggestions: string[];
  floating?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);
  const tools = use(AskAiToolsContext);

  function start() {
    setStarted(true);
    setOpen(true);
  }

  return (
    <>
      {floating ? (
        <button type="button" className="ai-fab" aria-label="AIに聞く" onClick={start}>
          <Sparkles aria-hidden="true" />
        </button>
      ) : (
        <Button
          className="ai-icon"
          variant="ghost"
          size="icon"
          aria-label="AIに聞く"
          onClick={start}
        >
          <Sparkles aria-hidden="true" />
        </Button>
      )}
      {started && (
        <Suspense fallback={<AskAiSheetSkeleton open={open} onOpenChange={setOpen} />}>
          <AskAiSheet
            page={page}
            suggestions={suggestions}
            tools={tools}
            open={open}
            onOpenChange={setOpen}
          />
        </Suspense>
      )}
    </>
  );
}

function AskAiSheetSkeleton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="ask-ai-sheet">
        <header className="ask-ai-header">
          <SheetTitle>AIに聞く</SheetTitle>
        </header>
        <div className="ask-ai-log">
          <p role="status" className="sr-only">
            読み込み中…
          </p>
          <Skeleton className="skeleton-line ask-ai-skeleton" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
