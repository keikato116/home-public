"use client";

import { useEffect, useState } from "react";
import { fetchWeather } from "@/lib/weather";
import { WeatherData } from "@/types";

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetchWeather(0, 0).then(setWeather);
  }, []);

  if (!weather) return <div className="w-16 h-8" />;

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
        alt={weather.description}
        width={64}
        height={64}
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }}
      />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[13px]">{weather.temp}°</span>
        {weather.rain1h != null && (
          <span className="text-[11px]">rain {weather.rain1h.toFixed(1)}mm</span>
        )}
      </div>
    </div>
  );
}
