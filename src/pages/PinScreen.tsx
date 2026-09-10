import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LockKeyhole, Loader2 } from "lucide-react";

export default function PinScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await login(pin); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); setPin(""); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background p-4"><section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
    <LockKeyhole className="mx-auto mb-4 h-8 w-8 text-primary" />
    <h1 className="text-center text-2xl font-bold">Person Registry</h1>
    <p className="mt-2 text-center text-sm text-muted-foreground">Enter your PIN to continue</p>
    <form onSubmit={submit} className="mt-6 space-y-4"><Label htmlFor="pin">PIN</Label>
      <Input id="pin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} autoFocus autoComplete="current-password" value={pin} disabled={loading} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }} className="text-center text-xl" required />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pin.length < 4 || loading}>{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}{loading ? "Unlocking…" : "Unlock"}</Button>
    </form>
  </section></main>;
}
