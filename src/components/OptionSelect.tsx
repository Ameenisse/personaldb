import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
interface Props { id: string; label: string; value: string; options: string[]; onChange: (value: string) => void; allLabel?: string; disabled?: boolean }
export function OptionSelect({ id, label, value, options, onChange, allLabel = "All", disabled }: Props) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label>
    <Select value={value || "all"} onValueChange={v => onChange(v === "all" ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent><SelectItem value="all">{allLabel}</SelectItem>{options.filter(v => v !== "all").map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
