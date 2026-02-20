import type { Edge, FilterState } from "./data";

export function filterEdges(edges: Edge[], f: FilterState): Edge[] {
  const hasTypeFilter = f.selectedTypes.size > 0;
  const hasStatusFilter = f.selectedStatus.size > 0;
  const hasCountryFilter = f.selectedCountries.size > 0;
  const hasContinentFilter = f.selectedContinents.size > 0;
  const searchLower = f.countrySearch.trim().toLowerCase();
  const hasSearch = searchLower.length > 0;
  const [yearLo, yearHi] = f.yearRange;

  return edges.filter((e) => {
    // Cheapest boolean check first
    if (!f.includeOrgAgreements && e.has_org_party) return false;

    // Set.has lookups (O(1))
    if (hasTypeFilter && !f.selectedTypes.has(e.agreement_type_code)) return false;
    if (hasStatusFilter && !f.selectedStatus.has(e.status_code)) return false;

    // Simple numeric comparisons
    if (e.signature_year > 0 && (e.signature_year < yearLo || e.signature_year > yearHi))
      return false;

    // Boolean field check
    if (f.intercontinentalMode === "inter" && !e.is_intercontinental) return false;
    if (f.intercontinentalMode === "intra" && e.is_intercontinental) return false;

    // Set lookups on continent
    if (hasContinentFilter) {
      const srcIn = f.selectedContinents.has(e.src_continent);
      const dstIn = f.selectedContinents.has(e.dst_continent);
      switch (f.continentMode) {
        case "either": if (!srcIn && !dstIn) return false; break;
        case "both":   if (!srcIn || !dstIn) return false; break;
        case "src":    if (!srcIn) return false; break;
        case "dst":    if (!dstIn) return false; break;
      }
    }

    // Set lookup on country name
    if (hasCountryFilter) {
      if (!f.selectedCountries.has(e.src_name) && !f.selectedCountries.has(e.dst_name))
        return false;
    }

    // Most expensive: string toLowerCase + includes (last)
    if (hasSearch) {
      if (!e.src_name.toLowerCase().includes(searchLower) &&
          !e.dst_name.toLowerCase().includes(searchLower))
        return false;
    }

    return true;
  });
}

export function isEdgeConnectedToCountry(
  edge: Edge,
  iso3: string | null
): boolean {
  if (!iso3) return false;
  return edge.src_iso3 === iso3 || edge.dst_iso3 === iso3;
}
