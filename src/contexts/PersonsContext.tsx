import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/appsScriptApi";
import type { Person } from "@/lib/person";

interface PersonsState {
  persons: Person[]; loading: boolean; error: string;
  reload: () => Promise<void>; remember: (person: Person) => void;
  getPhoto: (person: Person) => Promise<string>;
}
const PersonsContext = createContext<PersonsState | null>(null);
export function usePersons() {
  const context = useContext(PersonsContext);
  if (!context) throw new Error("PersonsProvider is required");
  return context;
}
export function PersonsProvider({ children }: { children: React.ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const photos = useRef(new Map<string, Promise<string>>());
  const inflight = useRef<Promise<void> | null>(null);
  const reload = useCallback(() => {
    if (inflight.current) return inflight.current;
    setLoading(true); setError("");
    const pending = api.list().then(setPersons).catch((err: Error) => { setError(err.message); throw err; })
      .finally(() => { setLoading(false); inflight.current = null; });
    inflight.current = pending;
    return pending;
  }, []);
  useEffect(() => { void reload().catch(() => {}); }, [reload]);
  const remember = useCallback((person: Person) => {
    setPersons(current => current.some(p => p.id === person.id) ? current.map(p => p.id === person.id ? person : p) : [...current, person]);
  }, []);
  const getPhoto = useCallback((person: Person) => {
    if (!person.photo_file_id) return Promise.resolve("");
    const key = person.photo_file_id;
    const cached = photos.current.get(key);
    if (cached) return cached;
    const pending = api.photo(person.id).then(result => result.dataUrl).catch(error => { photos.current.delete(key); throw error; });
    // Bounded in-memory cache; never store private photos in browser persistent storage.
    if (photos.current.size >= 24) { const oldest = photos.current.keys().next().value; if (oldest) photos.current.delete(oldest); }
    photos.current.set(key, pending);
    return pending;
  }, []);
  const value = useMemo(() => ({ persons, loading, error, reload, remember, getPhoto }), [persons, loading, error, reload, remember, getPhoto]);
  return <PersonsContext.Provider value={value}>{children}</PersonsContext.Provider>;
}
