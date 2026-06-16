import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Navigation } from "lucide-react";

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#1a2e1a]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f0d] via-[#2D6A4F] to-[#1a2e1a]" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg border border-white/10">
          <Navigation className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          TrailGuide AI
        </h1>
        <p className="text-white/70 text-lg mb-2 font-medium">
          Your Personal AI Travel Planner
        </p>
        <p className="text-white/50 text-sm mb-10 leading-relaxed max-w-xs">
          Plan your entire trip with AI and get guided every step of the way
        </p>

        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {["AI Itinerary", "Live Guide", "Navigation", "Discoveries"].map((f) => (
            <span
              key={f}
              className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="w-full flex flex-col gap-3">
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full bg-white text-[#2D6A4F] hover:bg-white/90 font-semibold rounded-xl h-12 text-base"
            )}
          >
            Start Planning for Free
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "w-full text-white/80 hover:text-white hover:bg-white/10 rounded-xl h-12"
            )}
          >
            Sign In
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-8">No credit card required</p>
      </div>
    </main>
  );
}
