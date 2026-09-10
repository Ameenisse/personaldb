import { format, isValid, parseISO } from "date-fns";
import type { ParsedPerson } from "./parsePersonText";

export interface Person extends ParsedPerson {
  id: string;
  photo_file_id: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
}

export const ATOLLS = ["HA.", "HDH.", "SH.", "N.", "R.", "B.", "LH.", "K.", "AA.", "ADH.", "V.", "M.", "F.", "DH.", "TH.", "L.", "GA.", "GDH.", "GN.", "S."];
export const emptyPerson: ParsedPerson = { id_no: "", name: "", dob: "", sex: "", contact: "", building: "", atoll: "", island: "", address_full: "" };
export const normalize = (value: string) => value.trim().toLocaleLowerCase();
export const same = (a: string, b: string) => normalize(a) === normalize(b);
export const isAll = (value: string) => !value || value === "all";
export function options(persons: Person[], field: "island" | "building", atoll = "", island = "") {
  const unique = new Map<string, string>();
  persons.filter(p => (isAll(atoll) || same(p.atoll, atoll)) && (isAll(island) || same(p.island, island)))
    .forEach(p => { const value = p[field].trim(); if (value) unique.set(normalize(value), value); });
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}
export function displayDate(value: string) {
  const date = parseISO(value);
  return isValid(date) ? format(date, "dd MMM yyyy") : "";
}
export const personAddress = (p: ParsedPerson) => [p.building, [p.atoll, p.island].filter(Boolean).join(" ")].filter(Boolean).join(", ");