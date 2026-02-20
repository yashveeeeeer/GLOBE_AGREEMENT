export interface Edge {
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

export interface CountryIndex {
  iso3: string;
  name: string;
  lat: number;
  lng: number;
  continent: string;
  total_edge_count: number;
  counts_by_type: Record<string, number>;
}

export interface FilterState {
  selectedTypes: Set<string>;
  selectedStatus: Set<string>;
  selectedContinents: Set<string>;
  selectedCountries: Set<string>;
  continentMode: "either" | "both" | "src" | "dst";
  intercontinentalMode: "all" | "inter" | "intra";
  yearRange: [number, number];
  countrySearch: string;
  selectedCountryIso3: string | null;
  includeOrgAgreements: boolean;
}

export interface DataMeta {
  allTypes: string[];
  allStatuses: string[];
  allContinents: string[];
  yearMin: number;
  yearMax: number;
}

export function extractMeta(edges: Edge[]): DataMeta {
  const types = new Set<string>();
  const statuses = new Set<string>();
  const continents = new Set<string>();
  let yearMin = Infinity;
  let yearMax = -Infinity;

  for (const e of edges) {
    if (e.agreement_type_code) types.add(e.agreement_type_code);
    if (e.status_code) statuses.add(e.status_code);
    if (e.src_continent) continents.add(e.src_continent);
    if (e.dst_continent) continents.add(e.dst_continent);
    if (e.signature_year > 0) {
      if (e.signature_year < yearMin) yearMin = e.signature_year;
      if (e.signature_year > yearMax) yearMax = e.signature_year;
    }
  }

  return {
    allTypes: Array.from(types).sort(),
    allStatuses: Array.from(statuses).sort(),
    allContinents: Array.from(continents).sort(),
    yearMin: yearMin === Infinity ? 1959 : yearMin,
    yearMax: yearMax === -Infinity ? 2026 : yearMax,
  };
}

export function defaultFilters(meta: DataMeta): FilterState {
  return {
    selectedTypes: new Set(),
    selectedStatus: new Set(),
    selectedContinents: new Set(),
    selectedCountries: new Set(),
    continentMode: "either",
    intercontinentalMode: "all",
    yearRange: [meta.yearMin, meta.yearMax],
    countrySearch: "",
    selectedCountryIso3: null,
    includeOrgAgreements: false,
  };
}

export interface PointDatum {
  iso3: string;
  name: string;
  lat: number;
  lng: number;
  continent: string;
  edgeCount: number;
  countsByType: Record<string, number>;
}

export function buildPointsFromEdges(edges: Edge[]): PointDatum[] {
  const map = new Map<
    string,
    { name: string; lat: number; lng: number; continent: string; count: number; byType: Record<string, number> }
  >();

  for (const e of edges) {
    for (const side of ["src", "dst"] as const) {
      const iso = side === "src" ? e.src_iso3 : e.dst_iso3;
      let entry = map.get(iso);
      if (!entry) {
        entry = {
          name: side === "src" ? e.src_name : e.dst_name,
          lat: side === "src" ? e.src_lat : e.dst_lat,
          lng: side === "src" ? e.src_lng : e.dst_lng,
          continent: side === "src" ? e.src_continent : e.dst_continent,
          count: 0,
          byType: {},
        };
        map.set(iso, entry);
      }
      entry.count++;
      entry.byType[e.agreement_type_code] =
        (entry.byType[e.agreement_type_code] || 0) + 1;
    }
  }

  return Array.from(map.entries()).map(([iso3, v]) => ({
    iso3,
    name: v.name,
    lat: v.lat,
    lng: v.lng,
    continent: v.continent,
    edgeCount: v.count,
    countsByType: v.byType,
  }));
}

/**
 * When `spread` is true, overlapping points (within ~1° of each other) fan out
 * into a ring so each entity is individually visible. When false, every cluster
 * collapses back to a single representative point (the non-ORG country wins).
 */
export function spreadOverlappingPoints(
  points: PointDatum[],
  spread: boolean
): PointDatum[] {
  const bucketKey = (lat: number, lng: number) =>
    `${Math.round(lat)}_${Math.round(lng)}`;

  const buckets = new Map<string, PointDatum[]>();
  for (const p of points) {
    const key = bucketKey(p.lat, p.lng);
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push(p);
  }

  const result: PointDatum[] = [];

  for (const group of buckets.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Sort: countries first (non-ORG), then by edgeCount descending.
    group.sort((a, b) => {
      const aOrg = a.iso3.startsWith("ORG_") ? 1 : 0;
      const bOrg = b.iso3.startsWith("ORG_") ? 1 : 0;
      if (aOrg !== bOrg) return aOrg - bOrg;
      return b.edgeCount - a.edgeCount;
    });

    if (!spread) {
      // Collapsed: only show the primary (country) representative.
      result.push(group[0]);
      continue;
    }

    // Spread: arrange in a ring around the centroid.
    const cLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const cLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
    const radius = 1.5;
    const n = group.length;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      result.push({
        ...group[i],
        lat: cLat + radius * Math.sin(angle),
        lng: cLng + radius * Math.cos(angle),
      });
    }
  }

  return result;
}
