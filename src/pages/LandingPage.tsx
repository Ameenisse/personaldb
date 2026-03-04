import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { differenceInYears, format, parseISO } from "date-fns";
import { Search, RotateCcw, Plus, Camera } from "lucide-react";
import CameraScanDialog from "@/components/CameraScanDialog";

type Person = Tables<"persons">;

const LandingPage = () => {
  const navigate = useNavigate();
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [filters, setFilters] = useState({ id: "", name: "", building: "", atoll: "", island: "", phone: "" });
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMatchIds, setCameraMatchIds] = useState<string[] | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("persons").select("*").limit(5000);
      if (data) setAllPersons(data);
    };
    fetchAll();
  }, []);

  const islandsForAtoll = useMemo(() => {
    if (!filters.atoll || filters.atoll === "all") return [];
    const islands = allPersons
      .filter((p) => p.atoll === filters.atoll && p.island)
      .map((p) => p.island!.trim())
      .filter(Boolean);
    return [...new Set(islands)].sort();
  }, [filters.atoll, allPersons]);

  const results = useMemo(() => {
    if (!searched) return [];
    if (cameraMatchIds) {
      return allPersons.filter((p) => cameraMatchIds.includes(p.id));
    }
    return allPersons.filter((p) => {
      const f = filters;
      if (f.id && !p.id_no.toLowerCase().includes(f.id.toLowerCase())) return false;
      if (f.name && !p.name.toLowerCase().includes(f.name.toLowerCase())) return false;
      if (f.building && !(p.building || "").toLowerCase().includes(f.building.toLowerCase())) return false;
      if (f.atoll && f.atoll !== "all" && p.atoll !== f.atoll) return false;
      if (f.island && f.island !== "all" && !(p.island || "").toLowerCase().includes(f.island.toLowerCase())) return false;
      if (f.phone && !(p.contact || "").includes(f.phone)) return false;
      return true;
    });
  }, [searched, filters, allPersons, cameraMatchIds]);

  useEffect(() => {
    if (!selected?.photo_path) { setPhotoUrl(null); return; }
    const { data } = supabase.storage.from("person-photos").getPublicUrl(selected.photo_path);
    setPhotoUrl(data.publicUrl);
  }, [selected]);

  const age = selected?.dob ? differenceInYears(new Date(), new Date(selected.dob)) : null;

  const handleReset = () => {
    setFilters({ id: "", name: "", building: "", atoll: "", island: "", phone: "" });
    setSearched(false);
    setSelected(null);
    setCameraMatchIds(null);
  };

  const handleAtollChange = (v: string) => {
    setFilters((f) => ({ ...f, atoll: v, island: "" }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>ID</Label>
              <Input value={filters.id} onChange={(e) => setFilters((f) => ({ ...f, id: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={filters.name} onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Building</Label>
              <Input value={filters.building} onChange={(e) => setFilters((f) => ({ ...f, building: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Atoll</Label>
              <Select value={filters.atoll} onValueChange={handleAtollChange}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {["HA.", "HDH.", "SH.", "N.", "R.", "B.", "LH.", "K.", "AA.", "ADH.", "V.", "M.", "F.", "DH.", "TH.", "L.", "GA.", "GDH.", "GN.", "S."].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Island</Label>
              <Select value={filters.island} onValueChange={(v) => setFilters((f) => ({ ...f, island: v }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {islandsForAtoll.map((isl) => (
                    <SelectItem key={isl} value={isl}>{isl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={filters.phone} onChange={(e) => setFilters((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSearched(true)}><Search className="mr-1 h-4 w-4" /> Search</Button>
            <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
            <Button variant="secondary" onClick={() => setCameraOpen(true)}><Camera className="mr-1 h-4 w-4" /> Camera Scan</Button>
            <Button variant="secondary" onClick={() => navigate("/completed")}><Plus className="mr-1 h-4 w-4" /> Add Person</Button>
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Building/Atoll/Island</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No results</TableCell></TableRow>
                  ) : results.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-accent"
                      onDoubleClick={() => setSelected(p)}
                    >
                      <TableCell>{p.id_no}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{[p.building, p.atoll, p.island].filter(Boolean).join(" ")}</TableCell>
                      <TableCell>{p.contact}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Person Info Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Person Info</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={selected.name}
                    className="max-h-36 rounded-lg object-cover shadow cursor-pointer"
                    onClick={() => setPhotoZoom(true)}
                  />
                ) : (
                  <div className="flex h-36 w-28 items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">No Photo</div>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium">Name:</span> {selected.name}</p>
                <p><span className="font-medium">ID No:</span> {selected.id_no}</p>
                <p><span className="font-medium">DOB:</span> {selected.dob ? format(parseISO(selected.dob), "dd MMM yyyy") : "N/A"}</p>
                <p><span className="font-medium">Age:</span> {age !== null ? `${age} years` : "N/A"}</p>
                <p><span className="font-medium">Sex:</span> {selected.sex || "N/A"}</p>
                <p><span className="font-medium">Address:</span> {selected.address_full || "N/A"}</p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">Contact:</span>
                  {selected.contact ? (
                    <>
                      <a href={`tel:${selected.contact}`} className="text-primary underline">{selected.contact}</a>
                      <a href={`tel:${selected.contact}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </a>
                    </>
                  ) : "N/A"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Zoom Dialog */}
      <Dialog open={photoZoom} onOpenChange={setPhotoZoom}>
        <DialogContent className="sm:max-w-lg flex items-center justify-center p-2">
          {photoUrl && (
            <img src={photoUrl} alt="Zoomed" className="max-h-[80vh] rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <CameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        allPersons={allPersons}
        onMatchResults={(matched) => {
          setCameraMatchIds(matched.map((p) => p.id));
          setSearched(true);
          if (matched.length === 1) {
            setSelected(matched[0]);
          }
        }}
      />
    </div>
  );
};

export default LandingPage;
