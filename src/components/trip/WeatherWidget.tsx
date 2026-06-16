"use client";
import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, Wind } from "lucide-react";

interface WeatherData {
  temperature: number;
  weather_code: number;
  wind_speed: number;
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  51: "Light drizzle",
  61: "Light rain",
  71: "Light snow",
  80: "Rain showers",
  95: "Thunderstorm",
};

function WeatherIcon({ code, className }: { code: number; className: string }) {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code <= 3 || code === 45) return <Cloud className={className} />;
  if (code >= 71 && code <= 79) return <CloudSnow className={className} />;
  if (code >= 95) return <CloudRain className={className} />;
  if (code >= 50) return <CloudRain className={className} />;
  return <Wind className={className} />;
}

export function WeatherWidget({
  lat,
  lng,
  destination,
}: {
  lat: number;
  lng: number;
  destination: string;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(`/api/weather?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setWeather(d))
      .catch(() => null);
  }, [lat, lng]);

  if (!weather) {
    return (
      <div className="bg-card rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-8 bg-muted rounded w-1/2" />
      </div>
    );
  }

  const desc = WMO_DESCRIPTIONS[weather.weather_code] ?? "Unknown";

  return (
    <div className="bg-card rounded-2xl p-4 flex items-center gap-4">
      <WeatherIcon
        code={weather.weather_code}
        className="w-10 h-10 text-primary flex-shrink-0"
      />
      <div>
        <p className="text-xs text-muted-foreground">{destination} right now</p>
        <p className="text-2xl font-bold">{Math.round(weather.temperature)}°C</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
