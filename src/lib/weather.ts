import { WeatherData } from "@/types";

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
