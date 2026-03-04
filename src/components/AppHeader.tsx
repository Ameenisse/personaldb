import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Search, Users, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const AppHeader = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Search", icon: Search },
    { path: "/completed", label: "Registry", icon: Users },
    { path: "/generate-sheet", label: "Generate Sheet", icon: FileText },
  ];

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm print:hidden">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-primary">Person Registry</h1>
        <nav className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Button
              key={path}
              variant={location.pathname === path ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate(path)}
            >
              <Icon className="mr-1 h-4 w-4" /> {label}
            </Button>
          ))}
        </nav>
      </div>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut className="mr-1 h-4 w-4" /> Logout
      </Button>
    </header>
  );
};

export default AppHeader;
