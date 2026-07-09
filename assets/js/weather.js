// weather.js - WeatherAPI helper

export async function fetchWeatherForAddress({ apiKey, addressLine }) {
  if (!addressLine) throw new Error('No address provided');
  const url = `https://api.weatherapi.com/v1/current.json?key=dab54fe9709b48569ef123921252209&q=${encodeURIComponent(addressLine)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} â€” ${r.statusText}`);
  const data = await r.json();
  if (!data?.current) throw new Error("No 'current' in response");

  const loc = data.location || {};
  const c = data.current || {};
  const locLabel = [loc.name, loc.region, loc.country].filter(Boolean).join(', ');

  return {
    address: addressLine,
    location_label: locLabel,
    temp_f: c.temp_f ?? null,
    pressure_in: c.pressure_in ?? null,
    wind_mph: c.wind_mph ?? null,
    wind_dir: c.wind_dir ?? null,
    wind_degree: c.wind_degree ?? null,
    last_updated: c.last_updated ?? null
  };
}

export function formatWeatherSummary(wx) {
  if (!wx) return '';
  const t = wx.temp_f != null ? `${Number(wx.temp_f).toFixed(1)} Â°F` : 'â€”';
  const p = wx.pressure_in != null ? `${Number(wx.pressure_in).toFixed(2)} inHg` : 'â€”';
  const w = wx.wind_mph != null ? `${Number(wx.wind_mph).toFixed(1)} mph` : 'â€”';
  const d = wx.wind_dir ?? 'â€”';
  const l = wx.location_label ?? 'â€”';
  return `Temp: ${t}
Pressure: ${p}
Wind: ${w}
Dir: ${d}
Loc: ${l}`;
}