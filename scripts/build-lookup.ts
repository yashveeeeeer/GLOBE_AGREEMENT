import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const csvPath = resolve(__dirname, "..", "RAW_DATA", "COUNTRY_LOOKUP.csv");
const outPath = resolve(__dirname, "..", "data", "iso3_lookup.json");

mkdirSync(dirname(outPath), { recursive: true });

const raw = readFileSync(csvPath, "utf-8");
const lines = raw.trim().split("\n");
const header = lines[0].split(",");

const lookup: Record<
  string,
  { country_name: string; lat: number; lng: number; continent: string }
> = {};

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  const iso3 = cols[0].trim();
  const country_name = cols[1].trim();
  const continent = cols[2].trim();
  const lat = parseFloat(cols[3]);
  const lng = parseFloat(cols[4]);
  if (iso3 && country_name) {
    lookup[iso3] = { country_name, lat, lng, continent };
  }
}

writeFileSync(outPath, JSON.stringify(lookup, null, 2), "utf-8");
console.log(`Wrote ${Object.keys(lookup).length} countries to ${outPath}`);
