"use client";
import { useState, useEffect } from "react";

export function CountdownTimer({ startDate }: { startDate: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    function update() {
      const target = new Date(startDate + "T00:00:00").getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setDisplay("Your trip has started!");
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);

      setDisplay(
        d > 0
          ? `${d}d ${h}h ${m}m until your trip`
          : `${h}h ${m}m until your trip`
      );
    }

    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [startDate]);

  if (!display) return null;

  return (
    <p className="text-sm font-medium text-primary mt-1">{display}</p>
  );
}
