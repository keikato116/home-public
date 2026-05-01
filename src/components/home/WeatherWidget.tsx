"use client";

import { useEffect, useState } from "react";
import { fetchWeather } from "@/lib/weather";
import { WeatherData } from "@/types";

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const data = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        setWeather(data);
      },
      () => {
        fetchWeather(35.6762, 139.6503).then(setWeather);
      }
    );
  }, []);

  if (!weather) return <div className="w-16 h-8" />;

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div
        className="rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(100, 160, 220, 0.18)", padding: "4px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
          alt={weather.description}
          width={64}
          height={64}
        />
      </div>
      <span className="text-[13px]">{weather.temp}°</span>
    </div>
  );
}
