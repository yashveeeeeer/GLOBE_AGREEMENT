import type { Edge, FilterState } from "./data";

export function filterEdges(edges: Edge[], f: FilterState): Edge[] {
  const searchLower = f.countrySearch.trim().toLowerCase();

  return edges.filter((e) => {
    if (!f.includeOrgAgreements && e.has_org_party) return false;

    if (f.selectedTypes.size > 0 && !f.selectedTypes.has(e.agreement_type_code))
      return false;

    if (f.selectedStatus.size > 0 && !f.selectedStatus.has(e.status_code))
      return false;

    if (e.signature_year > 0) {
      if (e.signature_year < f.yearRange[0] || e.signature_year > f.yearRange[1])
        return false;
    }

    if (f.intercontinentalMode === "inter" && !e.is_intercontinental)
      return false;
    if (f.intercontinentalMode === "intra" && e.is_intercontinental)
      return false;

    if (f.selectedContinents.size > 0) {
      const srcIn = f.selectedContinents.has(e.src_continent);
      const dstIn = f.selectedContinents.has(e.dst_continent);
      switch (f.continentMode) {
        case "either":
          if (!srcIn && !dstIn) return false;
          break;
        case "both":
          if (!srcIn || !dstIn) return false;
          break;
        case "src":
          if (!srcIn) return false;
          break;
        case "dst":
          if (!dstIn) return false;
          break;
      }
    }

    if (f.selectedCountries.size > 0) {
      const srcMatch = f.selectedCountries.has(e.src_name);
      const dstMatch = f.selectedCountries.has(e.dst_name);
      if (!srcMatch && !dstMatch) return false;
    }

    if (searchLower) {
      const srcMatch = e.src_name.toLowerCase().includes(searchLower);
      const dstMatch = e.dst_name.toLowerCase().includes(searchLower);
      if (!srcMatch && !dstMatch) return false;
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
