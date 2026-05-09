import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parsePersonText, type ParsedPerson } from "@/lib/parsePersonText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, ArrowLeft, X } from "lucide-react";

const empty: ParsedPerson = { id_no: "", name: "", dob: "", sex: "", contact: "", building: "", atoll: "", island: "", address_full: "" };

const CompletedPage = () => {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState("");
  const [form, setForm] = useState<ParsedPerson>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null); // DB uuid if duplicate
  const photoBoxRef = useRef<HTMLDivElement>(null);

  // Auto-parse when rawText changes
  useEffect(() => {
    if (!rawText.trim()) return;
    const parsed = parsePersonText(rawText);
    setForm(parsed);
  }, [rawText]);

  // Check for existing record when id_no changes
  useEffect(() => {
    const idNo = form.id_no.trim();
    if (!idNo) { setExistingId(null); setPhotoPreview(null); setPhoto(null); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from("persons").select("*").eq("id_no", idNo).maybeSingle();
      setExistingId(data?.id ?? null);
      if (data) {
        setForm({
          id_no: data.id_no,
          name: data.name || "",
          dob: data.dob || "",
          sex: data.sex || "",
          contact: data.contact || "",
          building: data.building || "",
          atoll: data.atoll || "",
          island: data.island || "",
          address_full: data.address_full || "",
        });
        if (data.photo_path && !photo) {
          const { data: urlData } = await supabase.storage.from("person-photos").createSignedUrl(data.photo_path, 300);
          if (urlData?.signedUrl) {
            setPhotoPreview(urlData.signedUrl);
          }
        }
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [form.id_no]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    const MAX_SIZE = 5 * 1024 * 1024;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (!ALLOWED.includes(file.type)) {
          toast({ title: "Invalid file type", description: "Only JPEG, PNG, or WebP images are allowed.", variant: "destructive" });
          return;
        }
        if (file.size > MAX_SIZE) {
          toast({ title: "File too large", description: "Maximum image size is 5 MB.", variant: "destructive" });
          return;
        }
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        return;
      }
    }
  }, []);

  useEffect(() => {
    const el = photoBoxRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste as EventListener);
    return () => el.removeEventListener("paste", handlePaste as EventListener);
  }, [handlePaste]);

  // Also listen globally for paste when photo box is focused
  useEffect(() => {
    document.addEventListener("paste", handlePaste as EventListener);
    return () => document.removeEventListener("paste", handlePaste as EventListener);
  }, [handlePaste]);

  const handleSave = async () => {
    if (!form.id_no || !form.name) {
      toast({ title: "Error", description: "ID No and Name are required.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const personData = {
      id_no: form.id_no,
      name: form.name,
      dob: form.dob || null,
      sex: form.sex || null,
      contact: form.contact || null,
      building: form.building || null,
      atoll: form.atoll || null,
      island: form.island || null,
      address_full: form.address_full || null,
    };

    let personId: string;

    if (existingId) {
      // Update existing
      const { error: updateErr } = await supabase.from("persons").update(personData).eq("id", existingId);
      if (updateErr) {
        console.error("Update failed:", updateErr);
        toast({ title: "Error", description: "Unable to save changes. Please try again.", variant: "destructive" });
        setSaving(false);
        return;
      }
      personId = existingId;
    } else {
      // Insert new
      const { data: person, error: insertErr } = await supabase.from("persons").insert(personData).select().single();
      if (insertErr || !person) {
        console.error("Insert failed:", insertErr);
        toast({ title: "Error", description: "Unable to save record. Please try again.", variant: "destructive" });
        setSaving(false);
        return;
      }
      personId = person.id;
    }

    // Upload photo
    if (photo) {
      const path = `persons/${form.id_no}_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("person-photos").upload(path, photo, { contentType: photo.type });
      if (!uploadErr) {
        await supabase.from("persons").update({ photo_path: path }).eq("id", personId);
      }
    }

    toast({ title: "Success", description: `${form.name} ${existingId ? "updated" : "saved"} successfully.` });
    setForm(empty);
    setRawText("");
    setPhoto(null);
    setPhotoPreview(null);
    setExistingId(null);
    setSaving(false);
  };

  const setField = (key: keyof ParsedPerson, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="mr-1 h-4 w-4" /> Back to Search</Button>

      <Card>
        <CardHeader>
          <CardTitle>Paste Raw Text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={6} placeholder="Paste person info here — fields will auto-fill…" value={rawText} onChange={(e) => setRawText(e.target.value)} />
          {rawText && (
            <Button variant="outline" size="sm" onClick={() => { setRawText(""); setForm(empty); setExistingId(null); setPhoto(null); setPhotoPreview(null); }}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Photo</CardTitle></CardHeader>
          <CardContent>
            <div
              ref={photoBoxRef}
              tabIndex={0}
              className="flex min-h-[200px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input bg-background p-4 text-center text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="max-h-56 rounded object-cover" />
              ) : (
                "Press Ctrl+V / Cmd+V to paste an image"
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Person Details</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setForm(empty); setExistingId(null); setPhoto(null); setPhotoPreview(null); setRawText(""); }}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>ID No</Label><Input value={form.id_no} onChange={(e) => setField("id_no", e.target.value)} /></div>
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>DOB</Label><Input type="date" value={form.dob} onChange={(e) => setField("dob", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v) => setField("sex", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Building</Label><Input value={form.building} onChange={(e) => setField("building", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Atoll</Label>
              <Select value={form.atoll} onValueChange={(v) => setField("atoll", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["HA.", "HDH.", "SH.", "N.", "R.", "B.", "LH.", "K.", "AA.", "ADH.", "V.", "M.", "F.", "DH.", "TH.", "L.", "GA.", "GDH.", "GN.", "S."].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Island</Label><Input value={form.island} onChange={(e) => setField("island", e.target.value)} /></div>
            <div className="space-y-1"><Label>Contact</Label><Input value={form.contact} onChange={(e) => setField("contact", e.target.value)} /></div>
            {existingId && (
              <p className="text-sm text-destructive font-medium">⚠ This ID already exists — saving will update the existing record.</p>
            )}
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : existingId ? "Update Database" : "Save to Database"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompletedPage;
