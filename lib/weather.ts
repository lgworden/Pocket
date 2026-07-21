// Open-Meteo — free, no API key. Geocode the user's location string, then pull
// today's forecast for it.

const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorms",
  96: "Thunderstorms",
  99: "Thunderstorms",
};

export type TodayWeather = {
  tempHighF: number;
  tempLowF: number;
  precipitationSumIn: number;
  windMaxMph: number;
  condition: string;
  label: string;
};

async function geocodeQuery(query: string) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`
  );
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// The geocoder matches plain city names well but chokes on "City, ST" style input
// (it's a simple name search, not an address parser) — fall back to just the part
// before the first comma if the full string doesn't match.
async function geocode(location: string): Promise<{ lat: number; lon: number; label: string }> {
  if (!location) throw new Error("No location set");
  const result = (await geocodeQuery(location)) ?? (await geocodeQuery(location.split(",")[0]));
  if (!result) throw new Error(`Couldn't find location: ${location}`);
  return {
    lat: result.latitude,
    lon: result.longitude,
    label: [result.name, result.admin1 ?? result.country].filter(Boolean).join(", "),
  };
}

export type TripWeather = {
  tempHighF: number; // warmest daily high across the trip
  tempLowF: number; // coldest daily low across the trip
  precipitationDays: number; // number of days with measurable rain
  windMaxMph: number;
  conditions: string[]; // distinct conditions seen across the trip
  label: string;
  days: number;
};

// Multi-day forecast for a destination, aggregated into one packing-oriented
// summary. Open-Meteo forecasts up to 16 days; anything longer falls back to the
// 16-day window (you pack for the range you can see). Used by the Pack My Bags flow.
export async function getTripWeather(location: string, days: number): Promise<TripWeather> {
  const { lat, lon, label } = await geocode(location);
  const forecastDays = Math.min(Math.max(days, 1), 16);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: String(forecastDays),
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = await res.json();
  const d = data.daily;

  const conditions = Array.from(
    new Set((d.weathercode as number[]).map((c) => WEATHER_CODES[c] ?? "Unknown"))
  );

  return {
    tempHighF: Math.round(Math.max(...(d.temperature_2m_max as number[]))),
    tempLowF: Math.round(Math.min(...(d.temperature_2m_min as number[]))),
    precipitationDays: (d.precipitation_sum as number[]).filter((p) => p >= 0.05).length,
    windMaxMph: Math.round(Math.max(...(d.windspeed_10m_max as number[]))),
    conditions,
    label,
    days: forecastDays,
  };
}

export async function getTodayWeather(location: string): Promise<TodayWeather> {
  const { lat, lon, label } = await geocode(location);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode",
    temperature_unit: "fahrenheit",
    windspeed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "1",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = await res.json();
  const code = data.daily.weathercode[0];

  return {
    tempHighF: Math.round(data.daily.temperature_2m_max[0]),
    tempLowF: Math.round(data.daily.temperature_2m_min[0]),
    precipitationSumIn: data.daily.precipitation_sum[0],
    windMaxMph: Math.round(data.daily.windspeed_10m_max[0]),
    condition: WEATHER_CODES[code] ?? "Unknown",
    label,
  };
}
