import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";

const AppLayout = () => (
  <div className="min-h-screen bg-muted">
    <AppHeader />
    <main className="mx-auto max-w-6xl p-4">
      <Outlet />
    </main>
  </div>
);

export default AppLayout;
