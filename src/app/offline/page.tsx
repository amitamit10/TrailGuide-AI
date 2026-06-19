"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl">✈️</div>
      <h1 className="text-2xl font-bold text-foreground">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-sm">
        No internet connection. Your trip timeline is still available if you
        visited it recently — go back and try navigating to it directly.
      </p>
      <button
        onClick={() => window.history.back()}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
      >
        Go back
      </button>
    </div>
  );
}
