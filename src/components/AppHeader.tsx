import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const AppHeader = () => {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
      <h1 className="text-xl font-bold text-primary">Person Registry</h1>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut className="mr-1 h-4 w-4" /> Logout
      </Button>
    </header>
  );
};

export default AppHeader;
