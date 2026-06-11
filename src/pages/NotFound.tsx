import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="actsix-panel w-full max-w-md p-6 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <p className="label-eyebrow">Page not found</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">404</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
          This route does not exist or has moved.
        </p>
        <Button asChild className="actsix-btn-primary mt-5">
          <a href="/">Return Home</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
