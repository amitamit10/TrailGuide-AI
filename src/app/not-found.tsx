import Link from "next/link";
import { Compass, MapPin, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6">
      <header className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        <span className="font-bold text-base text-primary">TrailGuide AI</span>
      </header>

      <main className="max-w-md mx-auto w-full text-center py-12">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Compass className="w-8 h-8 text-primary animate-pulse" />
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
        <h2 className="text-xl font-bold text-foreground mb-3">Off the beaten path</h2>
        <p className="text-sm text-muted-foreground mb-8">
          The page or itinerary you are looking for does not exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          <Link
            href="/explore"
            className="h-11 px-5 rounded-xl border border-border bg-card text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted transition-colors"
          >
            <Compass className="w-4 h-4" /> Explore Trips
          </Link>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TrailGuide AI. All rights reserved.
      </footer>
    </div>
  );
}
