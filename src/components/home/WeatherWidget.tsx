"use client";

import { useEffect, useState } from "react";
import { fetchWeather } from "@/lib/weather";
import { WeatherData } from "@/types";

const LOC_KEY = "weather_location";
const LOC_TTL = 60 * 60 * 1000; // 1 hour

function getCachedLocation(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const { lat, lon, ts } = JSON.parse(raw);
    if (Date.now() - ts > LOC_TTL) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

function setCachedLocation(lat: number, lon: number) {
  localStorage.setItem(LOC_KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const cached = getCachedLocation();
    if (cached) {
      fetchWeather(cached.lat, cached.lon).then(setWeather);
      return;
    }
    if (!navigator.geolocation) {
      fetchWeather(35.6762, 139.6503).then(setWeather);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCachedLocation(lat, lon);
        const data = await fetchWeather(lat, lon);
        setWeather(data);
      },
      () => {
        fetchWeather(35.6762, 139.6503).then(setWeather);
      }
    );
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
          <span className="text-[11px]">雨 {weather.rain1h.toFixed(1)}mm</span>
        )}
      </div>
    </div>
  );
}
