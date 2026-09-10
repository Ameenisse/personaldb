import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Search, Users, FileText } from "lucide-react";
import { NavLink } from "react-router-dom";
export default function AppHeader() {
  const { logout } = useAuth();
  return <header className="sticky top-0 z-30 border-b bg-card shadow-sm print:hidden"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
    <h1 className="text-lg font-bold text-primary">Person Registry</h1>
    <Button variant="ghost" size="icon" aria-label="Logout" title="Logout" onClick={logout} className="sm:order-3"><LogOut /></Button>
    <nav className="flex w-full gap-1 sm:w-auto" aria-label="Main navigation">{[{ path: "/", label: "Search", icon: Search }, { path: "/completed", label: "Add-Update", icon: Users }, { path: "/generate-sheet", label: "Generate Sheet", icon: FileText }].map(({ path, label, icon: Icon }) => <NavLink end to={path} key={path} className="min-w-0 flex-1 sm:flex-none">{({ isActive }) => <Button asChild variant={isActive ? "default" : "ghost"} className="w-full gap-1 px-2 text-xs sm:px-3 sm:text-sm"><span><Icon className="hidden min-[375px]:block" />{label}</span></Button>}</NavLink>)}</nav>
  </div></header>;
}
