import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Download, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Columns, FileSpreadsheet } from "lucide-react";
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Person = Tables<"persons">;

const ATOLLS = ["HA.", "HDH.", "SH.", "N.", "R.", "B.", "LH.", "K.", "AA.", "ADH.", "V.", "M.", "F.", "DH.", "TH.", "L.", "GA.", "GDH.", "GN.", "S."];

type ColumnKey = "id_no" | "name" | "dob" | "sex" | "building" | "atoll" | "island" | "contact";
type SortDir = "asc" | "desc";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "id_no", label: "ID" },
  { key: "name", label: "Name" },
  { key: "dob", label: "DOB" },
  { key: "sex", label: "Sex" },
  { key: "building", label: "Building" },
  { key: "atoll", label: "Atoll" },
  { key: "island", label: "Island" },
  { key: "contact", label: "Contact" },
];

const GenerateSheetPage = () => {
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [filters, setFilters] = useState({ atoll: "", island: "", building: "" });
  const [generated, setGenerated] = useState(false);
  const [sortCol, setSortCol] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(ALL_COLUMNS.map(c => c.key)));

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
    const filtered = allPersons.filter((p) => {
      const f = filters;
      if (f.atoll && f.atoll !== "all" && p.atoll !== f.atoll) return false;
      if (f.island && f.island !== "all" && !(p.island || "").toLowerCase().includes(f.island.toLowerCase())) return false;
      if (f.building && !(p.building || "").toLowerCase().includes(f.building.toLowerCase())) return false;
      return true;
    });
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va = (a[sortCol] ?? "") as string;
      let vb = (b[sortCol] ?? "") as string;
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [generated, filters, allPersons, sortCol, sortDir]);

  const toggleSort = (col: ColumnKey) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const toggleColumn = (col: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) { if (next.size > 1) next.delete(col); }
      else next.add(col);
      return next;
    });
  };

  const handleReset = () => {
    setFilters({ atoll: "", island: "", building: "" });
    setGenerated(false);
  };

  const getVisibleColumns = () => ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  const getTableData = () => {
    return results.map((p, i) => {
      const row: Record<string, string | number> = { "#": i + 1 };
      for (const col of getVisibleColumns()) {
        if (col.key === "dob") row[col.label] = p.dob ? format(parseISO(p.dob), "dd/MM/yyyy") : "";
        else row[col.label] = (p[col.key] ?? "") as string;
      }
      return row;
    });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Person Sheet — ${filterLabel}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`${results.length} records`, 14, 22);
    const cols = getVisibleColumns();
    const head = [["#", ...cols.map(c => c.label)]];
    const body = results.map((p, i) => [
      i + 1,
      ...cols.map(c => c.key === "dob" ? (p.dob ? format(parseISO(p.dob), "dd/MM/yyyy") : "") : (p[c.key] ?? "") as string),
    ]);
    autoTable(doc, { head, body, startY: 28, styles: { fontSize: 8 } });
    doc.save(`sheet-${filterLabel.replace(/\s*\/\s*/g, "-")}.pdf`);
  };

  const handleDownloadExcel = () => {
    const data = getTableData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet");
    XLSX.writeFile(wb, `sheet-${filterLabel.replace(/\s*\/\s*/g, "-")}.xlsx`);
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
              <>
                <Button variant="secondary" onClick={handleDownloadPDF}><Download className="mr-1 h-4 w-4" /> Download PDF</Button>
                <Button variant="secondary" onClick={handleDownloadExcel}><FileSpreadsheet className="mr-1 h-4 w-4" /> Download Excel</Button>
              </>
            )}
            {generated && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline"><Columns className="mr-1 h-4 w-4" /> Columns</Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded">
                      <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
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
                  {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map((col) => (
                    <TableHead key={col.key} className="cursor-pointer select-none" onClick={() => toggleSort(col.key)}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleCols.size + 1} className="text-center text-muted-foreground">No results</TableCell></TableRow>
                ) : results.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>{i + 1}</TableCell>
                    {visibleCols.has("id_no") && <TableCell>{p.id_no}</TableCell>}
                    {visibleCols.has("name") && <TableCell>{p.name}</TableCell>}
                    {visibleCols.has("dob") && <TableCell>{p.dob ? format(parseISO(p.dob), "dd/MM/yyyy") : ""}</TableCell>}
                    {visibleCols.has("sex") && <TableCell>{p.sex || ""}</TableCell>}
                    {visibleCols.has("building") && <TableCell>{p.building || ""}</TableCell>}
                    {visibleCols.has("atoll") && <TableCell>{p.atoll || ""}</TableCell>}
                    {visibleCols.has("island") && <TableCell>{p.island || ""}</TableCell>}
                    {visibleCols.has("contact") && <TableCell>{p.contact || ""}</TableCell>}
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
