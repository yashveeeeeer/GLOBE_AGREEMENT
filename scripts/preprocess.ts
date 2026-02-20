import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

interface Edge {
  edge_id: string;
  agreement_id: number;
  short_title: string;
  agreement_type_code: string;
  signature_date: string;
  signature_year: number;
  status_code: string;
  status_text: string;
  src_iso3: string;
  dst_iso3: string;
  src_name: string;
  dst_name: string;
  src_lat: number;
  src_lng: number;
  dst_lat: number;
  dst_lng: number;
  src_continent: string;
  dst_continent: string;
  is_intercontinental: boolean;
  continent_pair: string;
  has_org_party: boolean;
}

interface CountryIndex {
  iso3: string;
  name: string;
  lat: number;
  lng: number;
  continent: string;
  total_edge_count: number;
  counts_by_type: Record<string, number>;
}

interface OrgEntry {
  display_name: string;
  lat: number;
  lng: number;
  continent: string;
}

interface Iso3Entry {
  country_name: string;
  lat: number;
  lng: number;
  continent: string;
}

// ── Load lookups ────────────────────────────────────────────────────────
const orgLookup: Record<string, OrgEntry> = JSON.parse(
  readFileSync(resolve(root, "data", "org_lookup.json"), "utf-8")
);
const iso3Lookup: Record<string, Iso3Entry> = JSON.parse(
  readFileSync(resolve(root, "data", "iso3_lookup.json"), "utf-8")
);

// ── 1. Process existing country-country edges ───────────────────────────
const edgesCsvPath = resolve(root, "RAW_DATA", "AGREEMENT_EDGES.csv");
const csvRaw = readFileSync(edgesCsvPath, "utf-8");
const records: Record<string, string>[] = parse(csvRaw, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

console.log(`Country-country edge records from AGREEMENT_EDGES.csv: ${records.length}`);

const edges: Edge[] = [];
const typeCounts: Record<string, number> = {};
let skippedCountry = 0;

for (const row of records) {
  const agreementId = parseInt(row.agreement_id, 10);
  if (isNaN(agreementId)) { skippedCountry++; continue; }

  const srcLat = parseFloat(row.src_lat);
  const srcLng = parseFloat(row.src_lng);
  const dstLat = parseFloat(row.dst_lat);
  const dstLng = parseFloat(row.dst_lng);

  if (isNaN(srcLat) || isNaN(srcLng) || isNaN(dstLat) || isNaN(dstLng)) {
    skippedCountry++;
    continue;
  }

  const sigYear = parseInt(row.signature_year, 10);

  const edge: Edge = {
    edge_id: row.edge_key || `${agreementId}|${row.src_iso3}|${row.dst_iso3}`,
    agreement_id: agreementId,
    short_title: row.short_title || "",
    agreement_type_code: row.agreement_type_code || "",
    signature_date: row.signature_date || "",
    signature_year: isNaN(sigYear) ? -1 : sigYear,
    status_code: row.status_code || "",
    status_text: row.status_text || "",
    src_iso3: row.src_iso3,
    dst_iso3: row.dst_iso3,
    src_name: row.src_name || row.src_iso3,
    dst_name: row.dst_name || row.dst_iso3,
    src_lat: srcLat,
    src_lng: srcLng,
    dst_lat: dstLat,
    dst_lng: dstLng,
    src_continent: row.src_continent || "",
    dst_continent: row.dst_continent || "",
    is_intercontinental: row.is_intercontinental === "True",
    continent_pair: row.continent_pair || "",
    has_org_party: false,
  };

  edges.push(edge);
  typeCounts[edge.agreement_type_code] =
    (typeCounts[edge.agreement_type_code] || 0) + 1;
}

// ── 2. Process ORG agreements from the main CSV ─────────────────────────
const mainCsvPath = resolve(root, "RAW_DATA", "GLOBE_VIZ_UPDATED.csv");
const mainCsvRaw = readFileSync(mainCsvPath, "utf-8");
const mainRecords: Record<string, string>[] = parse(mainCsvRaw, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const existingAgreementIds = new Set(edges.map((e) => e.agreement_id));

const skippedCsvPath = resolve(root, "RAW_DATA", "AGREEMENT_EDGES_SKIPPED.csv");
const skippedCsvRaw = readFileSync(skippedCsvPath, "utf-8");
const skippedRecords: Record<string, string>[] = parse(skippedCsvRaw, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});
const skippedIds = new Set(skippedRecords.map((r) => parseInt(r.agreement_id, 10)));

console.log(`Skipped agreement IDs to reprocess for ORG: ${skippedIds.size}`);

interface ResolvedParty {
  id: string;
  name: string;
  lat: number;
  lng: number;
  continent: string;
  isOrg: boolean;
}

function resolveParty(
  canonicalName: string,
  iso3: string,
  kind: string
): ResolvedParty | null {
  if (kind === "COUNTRY") {
    const entry = iso3Lookup[iso3];
    if (!entry) return null;
    return {
      id: iso3,
      name: entry.country_name,
      lat: entry.lat,
      lng: entry.lng,
      continent: entry.continent,
      isOrg: false,
    };
  }

  // ORG: look up by canonical name
  const orgEntry = orgLookup[canonicalName];
  if (orgEntry) {
    const orgId = `ORG_${canonicalName.replace(/[^A-Za-z0-9]/g, "_").substring(0, 30)}`;
    return {
      id: orgId,
      name: orgEntry.display_name,
      lat: orgEntry.lat,
      lng: orgEntry.lng,
      continent: orgEntry.continent,
      isOrg: true,
    };
  }

  return null;
}

let orgEdgesCreated = 0;
let orgSkippedNoLookup = 0;
let orgSkippedSingleParty = 0;

for (const row of mainRecords) {
  const agreementId = parseInt(row.agreement_id, 10);
  if (isNaN(agreementId)) continue;
  if (!skippedIds.has(agreementId)) continue;
  if (existingAgreementIds.has(agreementId)) continue;

  const isoList = (row.party_iso3_list || "").split("|").map((s) => s.trim());
  const kindList = (row.party_kind_list || "").split("|").map((s) => s.trim());
  const nameList = (row.party_names_canonical || "").split("|").map((s) => s.trim());

  const resolved: ResolvedParty[] = [];
  for (let i = 0; i < isoList.length; i++) {
    const party = resolveParty(
      nameList[i] || "",
      isoList[i] || "",
      kindList[i] || ""
    );
    if (party) resolved.push(party);
  }

  if (resolved.length < 2) {
    orgSkippedSingleParty++;
    continue;
  }

  const sigYear = parseInt(row.signature_year, 10);
  const sigDate = row.signature_date || "";
  const typeCode = row.agreement_type_code || "";
  const statusCode = row.status_code || "";
  const statusText = row.status_text || "";
  const shortTitle = row.short_title || "";

  // Hub-and-spoke: first resolved party is hub
  const hub = resolved[0];
  const dedupSet = new Set<string>();

  for (let i = 1; i < resolved.length; i++) {
    const spoke = resolved[i];
    const pairKey = [hub.id, spoke.id].sort().join("|");
    const dedup = `${agreementId}|${pairKey}`;
    if (dedupSet.has(dedup)) continue;
    dedupSet.add(dedup);

    const srcContinent = hub.continent;
    const dstContinent = spoke.continent;
    const isInter = srcContinent !== dstContinent;

    const edge: Edge = {
      edge_id: `ORG_${agreementId}_${hub.id}_${spoke.id}`,
      agreement_id: agreementId,
      short_title: shortTitle,
      agreement_type_code: typeCode,
      signature_date: sigDate,
      signature_year: isNaN(sigYear) ? -1 : sigYear,
      status_code: statusCode,
      status_text: statusText,
      src_iso3: hub.id,
      dst_iso3: spoke.id,
      src_name: hub.name,
      dst_name: spoke.name,
      src_lat: hub.lat,
      src_lng: hub.lng,
      dst_lat: spoke.lat,
      dst_lng: spoke.lng,
      src_continent: srcContinent,
      dst_continent: dstContinent,
      is_intercontinental: isInter,
      continent_pair: `${srcContinent}->${dstContinent}`,
      has_org_party: true,
    };

    edges.push(edge);
    typeCounts[edge.agreement_type_code] =
      (typeCounts[edge.agreement_type_code] || 0) + 1;
    orgEdgesCreated++;
  }
}

// ── Sort ─────────────────────────────────────────────────────────────────
edges.sort((a, b) => {
  if (a.signature_year !== b.signature_year)
    return a.signature_year - b.signature_year;
  return a.agreement_id - b.agreement_id;
});

// ── Build countries index ────────────────────────────────────────────────
const countryMap = new Map<string, CountryIndex>();
for (const edge of edges) {
  for (const side of ["src", "dst"] as const) {
    const iso = side === "src" ? edge.src_iso3 : edge.dst_iso3;
    let c = countryMap.get(iso);
    if (!c) {
      c = {
        iso3: iso,
        name: side === "src" ? edge.src_name : edge.dst_name,
        lat: side === "src" ? edge.src_lat : edge.dst_lat,
        lng: side === "src" ? edge.src_lng : edge.dst_lng,
        continent: side === "src" ? edge.src_continent : edge.dst_continent,
        total_edge_count: 0,
        counts_by_type: {},
      };
      countryMap.set(iso, c);
    }
    c.total_edge_count++;
    c.counts_by_type[edge.agreement_type_code] =
      (c.counts_by_type[edge.agreement_type_code] || 0) + 1;
  }
}

const countries = Array.from(countryMap.values()).sort((a, b) =>
  a.iso3.localeCompare(b.iso3)
);

// ── Write output ─────────────────────────────────────────────────────────
const outDir = resolve(root, "public", "data");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  resolve(outDir, "agreements_edges.json"),
  JSON.stringify(edges),
  "utf-8"
);
writeFileSync(
  resolve(outDir, "countries_index.json"),
  JSON.stringify(countries),
  "utf-8"
);

const countryOnlyEdges = edges.filter((e) => !e.has_org_party).length;
const orgOnlyEdges = edges.filter((e) => e.has_org_party).length;
const uniqueAgreements = new Set(edges.map((e) => e.agreement_id)).size;

console.log(`\n=== Preprocessing Summary ===`);
console.log(`Source: RAW_DATA/AGREEMENT_EDGES.csv + RAW_DATA/GLOBE_VIZ_UPDATED.csv`);
console.log(`Country-country edges:       ${countryOnlyEdges}`);
console.log(`ORG-involved edges created:  ${orgOnlyEdges}`);
console.log(`Total edges produced:        ${edges.length}`);
console.log(`Unique agreements:           ${uniqueAgreements}`);
console.log(`Unique endpoints:            ${countries.length}`);
console.log(`Skipped (bad country data):  ${skippedCountry}`);
console.log(`ORG skipped (no lookup):     ${orgSkippedNoLookup}`);
console.log(`ORG skipped (single party):  ${orgSkippedSingleParty}`);
console.log(`\nCounts by agreement_type_code:`);
for (const [type, count] of Object.entries(typeCounts).sort(
  (a, b) => b[1] - a[1]
)) {
  console.log(`  ${type}: ${count}`);
}
console.log(`\nWrote: ${resolve(outDir, "agreements_edges.json")}`);
console.log(`Wrote: ${resolve(outDir, "countries_index.json")}`);
