import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";

type Person = Tables<"persons">;

const ATOLLS = ["HA.", "HDH.", "SH.", "N.", "R.", "B.", "LH.", "K.", "AA.", "ADH.", "V.", "M.", "F.", "DH.", "TH.", "L.", "GA.", "GDH.", "GN.", "S."];

const GenerateSheetPage = () => {
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [filters, setFilters] = useState({ atoll: "", island: "", building: "" });
  const [generated, setGenerated] = useState(false);

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

  const buildingsForSelection = useMemo(() => {
    const buildings = allPersons
      .filter((p) => {
        if (filters.atoll && filters.atoll !== "all" && p.atoll !== filters.atoll) return false;
        if (filters.island && filters.island !== "all" && !(p.island || "").toLowerCase().includes(filters.island.toLowerCase())) return false;
        return !!p.building;
      })
      .map((p) => p.building!.trim())
      .filter(Boolean);
    return [...new Set(buildings)].sort();
  }, [filters.atoll, filters.island, allPersons]);

  const results = useMemo(() => {
    if (!generated) return [];
    return allPersons.filter((p) => {
      const f = filters;
      if (f.atoll && f.atoll !== "all" && p.atoll !== f.atoll) return false;
      if (f.island && f.island !== "all" && !(p.island || "").toLowerCase().includes(f.island.toLowerCase())) return false;
      if (f.building && !(p.building || "").toLowerCase().includes(f.building.toLowerCase())) return false;
      return true;
    });
  }, [generated, filters, allPersons]);

  const handleReset = () => {
    setFilters({ atoll: "", island: "", building: "" });
    setGenerated(false);
  };

  const handleAtollChange = (v: string) => {
    setFilters((f) => ({ ...f, atoll: v, island: "", building: "" }));
  };

  const handleIslandChange = (v: string) => {
    setFilters((f) => ({ ...f, island: v, building: "" }));
  };

  const filterLabel = [
    filters.atoll && filters.atoll !== "all" ? filters.atoll : null,
    filters.island && filters.island !== "all" ? filters.island : null,
    filters.building || null,
  ].filter(Boolean).join(" / ") || "All";

  return (
    <div className="space-y-4">
      {/* Filter controls — hidden when printing */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Generate Sheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Atoll</Label>
              <Select value={filters.atoll} onValueChange={handleAtollChange}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ATOLLS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Island</Label>
              <Select value={filters.island} onValueChange={handleIslandChange}>
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
              <Label>Building</Label>
              <Select value={filters.building} onValueChange={(v) => setFilters((f) => ({ ...f, building: v }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {buildingsForSelection.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setGenerated(true)}><FileText className="mr-1 h-4 w-4" /> Generate</Button>
            <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
            {generated && results.length > 0 && (
              <Button variant="secondary" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Save as PDF</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sheet table — this is what gets printed */}
      {generated && (
        <Card id="sheet-table">
          <CardContent className="p-0 print:p-0">
            {/* Print header */}
            <div className="hidden print:block print:mb-4 print:p-4">
              <h1 className="text-lg font-bold">Person Sheet — {filterLabel}</h1>
              <p className="text-xs text-muted-foreground">{results.length} records</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Atoll</TableHead>
                  <TableHead>Island</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No results</TableCell></TableRow>
                ) : results.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{p.id_no}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.dob ? format(parseISO(p.dob), "dd/MM/yyyy") : ""}</TableCell>
                    <TableCell>{p.sex || ""}</TableCell>
                    <TableCell>{p.building || ""}</TableCell>
                    <TableCell>{p.atoll || ""}</TableCell>
                    <TableCell>{p.island || ""}</TableCell>
                    <TableCell>{p.contact || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GenerateSheetPage;
