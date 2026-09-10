import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersons } from "@/contexts/PersonsContext";
import { api } from "@/lib/appsScriptApi";
import { parsePersonText, type ParsedPerson } from "@/lib/parsePersonText";
import { ATOLLS, emptyPerson, options, same, type Person } from "@/lib/person";
import { compressPhoto } from "@/lib/photo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OptionSelect } from "@/components/OptionSelect";
import { DataStatus } from "@/components/DataStatus";
import { toast } from "@/hooks/use-toast";
import { Save, X, Clipboard, Loader2 } from "lucide-react";
export default function CompletedPage() {
  const { persons, loading, error, reload, remember, getPhoto } = usePersons();
  const [raw, setRaw] = useState(""); const [form, setForm] = useState<ParsedPerson>(emptyPerson);
  const [existing, setExisting] = useState<Person | null>(null);
  const [photo, setPhoto] = useState(""); const [oldPhoto, setOldPhoto] = useState(""); const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false); const [processing, setProcessing] = useState(false);
  const rawRef = useRef<HTMLTextAreaElement>(null); const imageVersion = useRef(0); const saveLock = useRef(false);
  const byId = useMemo(() => new Map(persons.map(p => [p.id_no.trim().toUpperCase(), p])), [persons]);
  const selectForm = (next: ParsedPerson) => {
    const match = byId.get(next.id_no.trim().toUpperCase());
    if (!same(next.id_no, form.id_no)) { imageVersion.current++; setPhoto(""); setProcessing(false); }
    setExisting(match || null); setForm(match ? { ...match } : next);
  };
  useEffect(() => {
    let active = true; setOldPhoto(""); setPhotoError("");
    if (existing?.photo_file_id) void getPhoto(existing).then(url => { if (active) setOldPhoto(url); }).catch((err: Error) => { if (active) setPhotoError(err.message); });
    return () => { active = false; };
  }, [existing, getPhoto]);
  const reset = useCallback(() => { imageVersion.current++; setRaw(""); setForm(emptyPerson); setExisting(null); setPhoto(""); setOldPhoto(""); setPhotoError(""); setProcessing(false); requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: "instant" }); rawRef.current?.focus(); }); }, []);
  useEffect(() => {
    const paste = async (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
      if (!item) return; // Text paste remains untouched.
      event.preventDefault(); if (saving || loading || error) return;
      const file = item.getAsFile(); if (!file) return;
      const version = ++imageVersion.current; setProcessing(true);
      try { const result = await compressPhoto(file); if (version === imageVersion.current) setPhoto(result); }
      catch (err) { toast({ title: "Photo not added", description: err instanceof Error ? err.message : "Unable to process photo.", variant: "destructive" }); }
      finally { if (version === imageVersion.current) setProcessing(false); }
    };
    document.addEventListener("paste", paste);
    return () => { document.removeEventListener("paste", paste); imageVersion.current++; };
  }, [saving, loading, error]);
  const setField = (key: keyof ParsedPerson, value: string) => {
    if (key === "id_no") selectForm({ ...(existing ? emptyPerson : form), id_no: value.toUpperCase() });
    else setForm(current => ({ ...current, [key]: value }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (saveLock.current || processing || loading || error) return;
    saveLock.current = true; setSaving(true);
    try {
      const result = await api.save(form, existing?.id, photo || undefined);
      remember(result.person); reset();
      toast({ title: result.created ? "Person saved" : "Person updated", description: result.warning || `${result.person.name} saved successfully.` });
      try { await reload(); } catch { toast({ title: "Saved; list refresh failed", description: "Your record was saved. Retry loading the list before the next entry.", variant: "destructive" }); }
    } catch (err) { toast({ title: "Unable to save", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }); }
    finally { saveLock.current = false; setSaving(false); requestAnimationFrame(() => rawRef.current?.focus()); }
  };
  return <div className="space-y-5"><DataStatus /><form onSubmit={save}><fieldset disabled={saving || loading || !!error} className="space-y-5">
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6"><Label htmlFor="raw-text" className="mb-4 block text-xl font-semibold">Paste Raw Text</Label><Textarea id="raw-text" ref={rawRef} rows={6} value={raw} onChange={e => { setRaw(e.target.value); if (e.target.value.trim()) selectForm(parsePersonText(e.target.value)); }} /><Button type="button" variant="outline" className="mt-3" onClick={reset}><X />Clear</Button></section>
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Person Details</h2><Button type="button" variant="outline" onClick={reset}><X />Clear</Button></div>
      {existing && <p role="status" className="mb-4 rounded-md border bg-accent p-3 text-sm font-medium">This ID already exists. Saving will update the existing person.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{([{ key: "id_no", label: "ID No", required: true }, { key: "name", label: "Name", required: true }, { key: "dob", label: "DOB", type: "date" }] as const).map(field => <div key={field.key} className="min-w-0 space-y-1.5"><Label htmlFor={`person-${field.key}`}>{field.label}</Label><Input id={`person-${field.key}`} type={"type" in field ? field.type : "text"} required={"required" in field} pattern={field.key === "id_no" ? "[A-Z][0-9]{5,8}" : undefined} value={form[field.key]} onChange={e => setField(field.key, e.target.value)} /></div>)}
        <OptionSelect id="person-sex" label="Sex" allLabel="Select" value={form.sex} options={["Male", "Female"]} onChange={v => setField("sex", v)} />
        <div className="space-y-1.5"><Label htmlFor="person-building">Building</Label><Input id="person-building" value={form.building} list="building-options" onChange={e => setField("building", e.target.value)} /><datalist id="building-options">{options(persons, "building", form.atoll, form.island).map(v => <option key={v} value={v} />)}</datalist></div>
        <OptionSelect id="person-atoll" label="Atoll" allLabel="Select" value={form.atoll} options={ATOLLS} onChange={v => { setField("atoll", v); setField("island", ""); }} />
        <div className="space-y-1.5"><Label htmlFor="person-island">Island</Label><Input id="person-island" list="island-options" value={form.island} onChange={e => setField("island", e.target.value)} /><datalist id="island-options">{options(persons, "island", form.atoll).map(v => <option key={v} value={v} />)}</datalist></div>
        <div className="space-y-1.5"><Label htmlFor="person-contact">Contact</Label><Input id="person-contact" type="tel" value={form.contact} onChange={e => setField("contact", e.target.value)} /></div>
      </div>
    </section>
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6"><h2 className="mb-4 text-xl font-semibold">Photo</h2><div tabIndex={0} aria-label="Paste Image Here" className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-input bg-muted p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {photo || oldPhoto ? <img src={photo || oldPhoto} alt={form.name || "Person photo"} className="max-h-64 max-w-full rounded object-contain" /> : <Clipboard className="h-8 w-8 text-muted-foreground" />}
      <p className="font-medium">{processing ? "Processing image…" : "Paste Image Here"}</p><p className="text-sm text-muted-foreground">Copy a photo and paste it here. JPEG, PNG, or WebP · up to 5 MB.</p>
    </div>{photoError && !photo && <p className="mt-2 text-sm text-destructive">{photoError} The existing photo will be kept.</p>}{photo && <Button type="button" variant="outline" className="mt-3" onClick={() => { imageVersion.current++; setPhoto(""); setProcessing(false); }}><X />Remove Photo</Button>}</section>
    <Button type="submit" className="h-14 w-full text-base" disabled={saving || processing || loading || !!error}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : existing ? "Update Person" : "Quick Save"}</Button>
  </fieldset></form></div>;
}
