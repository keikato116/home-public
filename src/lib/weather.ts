import { WeatherData } from "@/types";

export async function fetchWeather(_lat?: number, _lon?: number): Promise<WeatherData | null> {
  try {
    const res = await fetch("/api/weather");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
