import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-8xl font-display font-bold text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">404</h1>
        <h2 className="text-2xl font-bold">Page Not Found</h2>
        <p className="text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="pt-4">
          <Button asChild className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-8">
            <Link href="/client/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
