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

  if (!weather) return <div className="w-10 h-5" />;

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
        alt={weather.description}
        width={48}
        height={48}
        className="opacity-80"
      />
      <span className="text-[12px]">{weather.temp}°</span>
    </div>
  );
}
