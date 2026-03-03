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
import { differenceInYears, format, parseISO } from "date-fns";
import { Search, RotateCcw, Plus } from "lucide-react";

type Person = Tables<"persons">;

const LandingPage = () => {
  const navigate = useNavigate();
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [filters, setFilters] = useState({ id: "", name: "", building: "", atoll: "", island: "", phone: "" });
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("persons").select("*").limit(5000);
      if (data) setAllPersons(data);
    };
    fetchAll();
  }, []);

  const results = useMemo(() => {
    if (!searched) return [];
    return allPersons.filter((p) => {
      const f = filters;
      if (f.id && !p.id_no.toLowerCase().includes(f.id.toLowerCase())) return false;
      if (f.name && !p.name.toLowerCase().includes(f.name.toLowerCase())) return false;
      if (f.building && !(p.building || "").toLowerCase().includes(f.building.toLowerCase())) return false;
      if (f.atoll && f.atoll !== "all" && p.atoll !== f.atoll) return false;
      if (f.island && !(p.island || "").toLowerCase().includes(f.island.toLowerCase())) return false;
      if (f.phone && !(p.contact || "").includes(f.phone)) return false;
      return true;
    });
  }, [searched, filters, allPersons]);

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
              <Select value={filters.atoll} onValueChange={(v) => setFilters((f) => ({ ...f, atoll: v }))}>
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
              <Input value={filters.island} onChange={(e) => setFilters((f) => ({ ...f, island: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={filters.phone} onChange={(e) => setFilters((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSearched(true)}><Search className="mr-1 h-4 w-4" /> Search</Button>
            <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
            <Button variant="secondary" onClick={() => navigate("/completed")}><Plus className="mr-1 h-4 w-4" /> Add Person</Button>
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardContent className="p-0">
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
                    className="cursor-pointer"
                    onDoubleClick={() => setSelected(p)}
                    data-state={selected?.id === p.id ? "selected" : undefined}
                  >
                    <TableCell>{p.id_no}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{[p.building, p.atoll, p.island].filter(Boolean).join(" ")}</TableCell>
                    <TableCell>{p.contact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Person Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt={selected.name} className="max-h-48 rounded-lg object-cover shadow" />
                ) : (
                  <div className="flex h-48 w-36 items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">No Photo</div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {selected.name}</p>
                <p><span className="font-medium">ID No:</span> {selected.id_no}</p>
                <p><span className="font-medium">DOB:</span> {selected.dob ? format(parseISO(selected.dob), "dd MMM yyyy") : "N/A"}</p>
                <p><span className="font-medium">Age:</span> {age !== null ? `${age} years` : "N/A"}</p>
                <p><span className="font-medium">Sex:</span> {selected.sex || "N/A"}</p>
                <p><span className="font-medium">Address:</span> {selected.address_full || "N/A"}</p>
                <p><span className="font-medium">Contact:</span> {selected.contact || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LandingPage;
