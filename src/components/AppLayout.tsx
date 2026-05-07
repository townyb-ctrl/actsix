import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCw, Zap } from "lucide-react";

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar text-sidebar-foreground font-extrabold tracking-wider">
        ACT<span className="text-brand-teal-bright">SIX</span>
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-content">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" className="gap-1.5 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full px-4">
                <Zap className="h-3.5 w-3.5" /> Quick Capture
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
                <RotateCw className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-full">
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
