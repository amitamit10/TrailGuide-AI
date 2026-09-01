export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-xs font-medium text-muted-foreground tracking-wide">
          Loading TrailGuide AI...
        </span>
      </div>
    </div>
  );
}
