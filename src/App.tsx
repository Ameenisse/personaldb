import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import PinScreen from "./pages/PinScreen";
import AdminLogin from "./pages/AdminLogin";
import LandingPage from "./pages/LandingPage";
import CompletedPage from "./pages/CompletedPage";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isPinUnlocked, session, loading } = useAuth();
  if (!isPinUnlocked) return <Navigate to="/pin" replace />;
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PinRoute() {
  const { isPinUnlocked } = useAuth();
  if (isPinUnlocked) return <Navigate to="/" replace />;
  return <PinScreen />;
}

function LoginRoute() {
  const { isPinUnlocked, session, loading } = useAuth();
  if (!isPinUnlocked) return <Navigate to="/pin" replace />;
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <AdminLogin />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/pin" element={<PinRoute />} />
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/completed" element={<CompletedPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
