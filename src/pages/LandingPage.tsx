import { useMemo, useRef, useState, useEffect } from "react";
import { usePersons } from "@/contexts/PersonsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OptionSelect } from "@/components/OptionSelect";
import { DataStatus } from "@/components/DataStatus";
import { ATOLLS, displayDate, normalize, options, same, type Person } from "@/lib/person";
import { differenceInYears, parseISO, isValid } from "date-fns";
import { Search, RotateCcw, Phone, UserRound } from "lucide-react";
const empty = { id: "", name: "", building: "", atoll: "", island: "", phone: "" };
export default function LandingPage() {
  const { persons, loading, error, getPhoto } = usePersons();
  const [filters, setFilters] = useState(empty);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [zoom, setZoom] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const change = (key: keyof typeof empty, value: string) => { setSearched(false); setFilters(f => ({ ...f, [key]: value, ...(key === "atoll" ? { island: "", building: "" } : key === "island" ? { building: "" } : {}) })); };
  const results = useMemo(() => !searched ? [] : persons.filter(p => (!filters.id || normalize(p.id_no).includes(normalize(filters.id))) && (!filters.name || normalize(p.name).includes(normalize(filters.name))) && (!filters.building || (filters.island ? same(p.building, filters.building) : normalize(p.building).includes(normalize(filters.building)))) && (!filters.atoll || same(p.atoll, filters.atoll)) && (!filters.island || same(p.island, filters.island)) && (!filters.phone || p.contact.includes(filters.phone.trim()))), [persons, filters, searched]);
  useEffect(() => {
    let active = true; setPhoto(""); setPhotoError(""); setZoom(false);
    if (selected?.photo_file_id) void getPhoto(selected).then(url => { if (active) setPhoto(url); }).catch((err: Error) => { if (active) setPhotoError(err.message); });
    return () => { active = false; };
  }, [selected, getPhoto]);
  const age = selected?.dob && isValid(parseISO(selected.dob)) ? differenceInYears(new Date(), parseISO(selected.dob)) : null;
  return <div className="space-y-5"><DataStatus />
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6"><h2 className="mb-5 flex items-center gap-2 text-xl font-semibold"><Search className="h-5 w-5" />Search</h2>
      <form onSubmit={e => { e.preventDefault(); setSearched(true); }} className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="search-id">ID</Label><Input id="search-id" ref={idRef} value={filters.id} onChange={e => change("id", e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="search-name">Name</Label><Input id="search-name" value={filters.name} onChange={e => change("name", e.target.value)} /></div>
        <OptionSelect id="search-atoll" label="Atoll" value={filters.atoll} options={ATOLLS} onChange={v => change("atoll", v)} />
        <OptionSelect id="search-island" label="Island" value={filters.island} options={options(persons, "island", filters.atoll)} onChange={v => change("island", v)} />
        {filters.island ? <OptionSelect id="search-building" label="Building" value={filters.building} options={options(persons, "building", filters.atoll, filters.island)} onChange={v => change("building", v)} /> : <div className="space-y-1.5"><Label htmlFor="search-building">Building</Label><Input id="search-building" value={filters.building} onChange={e => change("building", e.target.value)} /></div>}
        <div className="space-y-1.5"><Label htmlFor="search-phone">Phone</Label><Input id="search-phone" type="tel" value={filters.phone} onChange={e => change("phone", e.target.value)} /></div>
      </div><div className="flex gap-2"><Button type="submit" disabled={loading || !!error}><Search />Search</Button><Button type="button" variant="outline" onClick={() => { setFilters(empty); setSearched(false); idRef.current?.focus(); }}><RotateCcw />Reset</Button></div></form>
    </section>
    {searched && <section aria-label="Search results"><p className="mb-2 text-sm text-muted-foreground">{results.length} results</p><div className="max-h-[320px] overflow-auto rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Building/Atoll/Island</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader><TableBody>{results.length ? results.map(p => <TableRow key={p.id} tabIndex={0} className="cursor-pointer" onClick={() => setSelected(p)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p); } }}><TableCell className="whitespace-nowrap">{p.id_no}</TableCell><TableCell className="min-w-40">{p.name}</TableCell><TableCell className="min-w-48">{[p.building, p.atoll, p.island].filter(Boolean).join(" ")}</TableCell><TableCell className="whitespace-nowrap">{p.contact}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="text-center">No results</TableCell></TableRow>}</TableBody></Table></div></section>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Person Info</DialogTitle><DialogDescription className="sr-only">Selected person details</DialogDescription></DialogHeader>{selected && <div className="space-y-4">
      <div className="flex justify-center">{photo ? <Button variant="ghost" className="h-auto p-0" aria-label="Enlarge photo" onClick={() => setZoom(true)}><img src={photo} alt={selected.name} className="h-36 max-w-full rounded-md object-contain" /></Button> : <div className="flex h-36 w-28 flex-col items-center justify-center gap-2 rounded-md bg-muted text-xs text-muted-foreground"><UserRound className="h-8 w-8" />{photoError ? "Photo unavailable" : selected.photo_file_id ? "Loading photo…" : "No photo"}</div>}</div>
      {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
      <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 break-words text-sm">{[["Name", selected.name], ["ID", selected.id_no], ["DOB", displayDate(selected.dob)], ["Age", age === null ? "" : `${age} years`], ["Sex", selected.sex], ["Address", selected.address_full]].map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 font-medium">{value || "—"}</dd></div>)}<dt className="pt-3 text-muted-foreground">Contact</dt><dd>{selected.contact ? selected.contact.split(/\s*\/\s*/).map(num => <div key={num} className="flex items-center justify-between gap-2"><a className="text-primary underline" href={`tel:${num.replace(/[^+\d]/g, "")}`}>{num}</a><Button asChild variant="outline" size="icon"><a href={`tel:${num.replace(/[^+\d]/g, "")}`} aria-label={`Call ${num}`}><Phone /></a></Button></div>) : "—"}</dd></dl>
    </div>}</DialogContent></Dialog>
    <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="max-h-[95dvh] sm:max-w-2xl"><DialogHeader><DialogTitle>Photo</DialogTitle><DialogDescription className="sr-only">Enlarged person photo</DialogDescription></DialogHeader>{photo && <img src={photo} alt={selected?.name || "Person"} className="max-h-[75dvh] w-full object-contain" />}</DialogContent></Dialog>
  </div>;
}
