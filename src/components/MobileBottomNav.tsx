import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutGrid, 
  ListChecks, 
  FolderKanban, 
  Users, 
  Calendar, 
  Inbox, 
  Music 
} from "lucide-react";
import { cn } from "@/lib/utils";

import actsixIcon from "@/assets/branding/actsix-icon-black.png";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const leftItems = [
    { icon: LayoutGrid, label: "Home", path: "/" },
    { icon: Inbox, label: "Inbox", path: "/inbox" },
  ];

  const rightItems = [
    { icon: Calendar, label: "Meetings", path: "/meetings" },
    { icon: Users, label: "People", path: "/people" },
  ];

  const allModules = [
    { icon: ListChecks, label: "Tasks", path: "/tasks", color: "bg-blue-500/10 text-blue-500" },
    { icon: FolderKanban, label: "Projects", path: "/projects", color: "bg-purple-500/10 text-purple-500" },
    { icon: Users, label: "People", path: "/people", color: "bg-green-500/10 text-green-500" },
    { icon: Calendar, label: "Meetings", path: "/meetings", color: "bg-orange-500/10 text-orange-500" },
    { icon: Music, label: "Services", path: "/service-planner/teams", color: "bg-brand-teal/10 text-brand-teal" },
    { icon: Inbox, label: "Inbox", path: "/inbox", color: "bg-pink-500/10 text-pink-500" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="relative flex items-center justify-between h-16 px-4">
        
        <div className="flex items-center justify-center gap-8 w-[40%]">
          {leftItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className={cn("flex flex-col items-center justify-center space-y-1 text-muted-foreground transition-colors", isActive && "text-brand-teal")}>
                <Icon className={cn("w-5 h-5", isActive && "fill-brand-teal/20")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="absolute left-1/2 -top-6 -translate-x-1/2 flex justify-center">
          <Drawer open={switcherOpen} onOpenChange={setSwitcherOpen}>
            <DrawerTrigger asChild>
              <button 
                className="flex items-center justify-center w-[60px] h-[60px] bg-white rounded-full shadow-lg border-[5px] border-background focus:outline-none active:scale-95 transition-transform"
                aria-label="Open Module Switcher"
              >
                {/* ICON INCREASED TO 50px */}
                <img src={actsixIcon} alt="ACTSIX" className="w-[50px] h-[50px] object-contain" />
              </button>
            </DrawerTrigger>
            
            <DrawerContent>
              <DrawerHeader className="text-left pb-2">
                <DrawerTitle className="text-lg font-bold">Switch Module</DrawerTitle>
              </DrawerHeader>
              
              <div className="grid grid-cols-3 gap-3 px-4 pb-10 pt-2">
                {allModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <button
                      key={module.path}
                      onClick={() => {
                        setSwitcherOpen(false);
                        navigate(module.path);
                      }}
                      className="flex flex-col items-center justify-center p-4 gap-3 rounded-2xl border border-border/50 bg-card shadow-soft active:scale-95 transition-all"
                    >
                      <div className={cn("p-3 rounded-full", module.color)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground text-center line-clamp-1">{module.label}</span>
                    </button>
                  );
                })}
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="flex items-center justify-center gap-8 w-[40%]">
          {rightItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className={cn("flex flex-col items-center justify-center space-y-1 text-muted-foreground transition-colors", isActive && "text-brand-teal")}>
                <Icon className={cn("w-5 h-5", isActive && "fill-brand-teal/20")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
        
      </div>
    </nav>
  );
}