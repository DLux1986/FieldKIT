// samples.js

import { loadJSON } from "./utils.js";

export async function loadSamples() {
  try {
    const data = await loadJSON("assets/data/samples.json");

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.samples)) return data.samples;

    console.warn("Unrecognized samples format:", data);
  } catch (errJson) {
    console.warn("Samples JSON load failed:", errJson);
  }

  // CSV fallback (optional)
  try {
    const r = await fetch("assets/data/samples.csv", { cache: "no-store" });
    if (!r.ok) throw new Error(`samples.csv HTTP ${r.status}`);

    const text = await r.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines.shift().split(",");

    const idx = name => header.indexOf(name);

    const idI = idx("id");
    const visitI = idx("visit_id");
    const resultI = idx("result");
    const testNumI = idx("test_number");

    return lines.map(line => {
      const cols = line.split(",");
      return {
        id: cols[idI]?.trim(),
        visit_id: cols[visitI]?.trim(),
        result: cols[resultI]?.trim(),
        test_number: cols[testNumI]?.trim()
      };
    });
  } catch (errCsv) {
    console.error("Samples CSV load failed:", errCsv);
  }

  return [];
}
