import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PersonsProvider } from "@/contexts/PersonsContext";
import { isApiConfigured } from "@/lib/appsScriptApi";
import PinScreen from "./pages/PinScreen";
import SetupRequired from "./pages/SetupRequired";
import LandingPage from "./pages/LandingPage";
import CompletedPage from "./pages/CompletedPage";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
const GenerateSheetPage = lazy(() => import("./pages/GenerateSheetPage"));

function AppRoutes() {
  const { session } = useAuth();
  if (!isApiConfigured) return <SetupRequired />;
  if (!session) return <PinScreen />;
  return <PersonsProvider key={session.token}><Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/completed" element={<CompletedPage />} />
      <Route path="/generate-sheet" element={<Suspense fallback={<p role="status">Loading sheet…</p>}><GenerateSheetPage /></Suspense>} />
    </Route>
    <Route path="/pin" element={<Navigate to="/" replace />} />
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes></PersonsProvider>;
}
export default function App() {
  return <TooltipProvider><Toaster /><Sonner /><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></TooltipProvider>;
}
