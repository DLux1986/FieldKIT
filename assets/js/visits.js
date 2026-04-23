// visits.js

import { loadJSON } from "./utils.js";

export async function loadVisits() {
  try {
    const data = await loadJSON("assets/data/visits.json");

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.visits)) return data.visits;

    console.warn("Unrecognized visits format:", data);
  } catch (errJson) {
    console.warn("Visits JSON load failed:", errJson);
  }

  // CSV fallback (optional)
  try {
    const r = await fetch("assets/data/visits.csv", { cache: "no-store" });
    if (!r.ok) throw new Error(`visits.csv HTTP ${r.status}`);

    const text = await r.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift().split(",");

    const idx = name => header.indexOf(name);

    const idI = idx("id");
    const dateI = idx("date");
    const typeI = idx("test_type");
    const numI = idx("visit_number");

    return lines.map(line => {
      const cols = line.split(",");
      return {
        id: cols[idI]?.trim(),
        date: cols[dateI]?.trim(),
        test_type: cols[typeI]?.trim(),
        visit_number: cols[numI]?.trim()
      };
    });
  } catch (errCsv) {
    console.error("Visits CSV load failed:", errCsv);
  }

  return [];
}
