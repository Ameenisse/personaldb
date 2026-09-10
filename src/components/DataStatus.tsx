import { usePersons } from "@/contexts/PersonsContext";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
export function DataStatus() {
  const { loading, error, reload } = usePersons();
  if (loading) return <p role="status" className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading persons…</p>;
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive p-3 text-sm"><p className="flex-1 text-destructive">{error}</p><Button variant="outline" onClick={() => void reload().catch(() => {})}><RotateCcw /> Retry</Button></div>;
  return null;
}
