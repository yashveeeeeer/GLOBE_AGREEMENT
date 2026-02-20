import type { FilterState, DataMeta } from "./data";
import { defaultFilters } from "./data";

export function filtersToSearchParams(
  filters: FilterState,
  meta: DataMeta
): URLSearchParams {
  const p = new URLSearchParams();
  const def = defaultFilters(meta);

  if (filters.selectedTypes.size > 0)
    p.set("types", Array.from(filters.selectedTypes).join(","));

  if (filters.selectedStatus.size > 0)
    p.set("status", Array.from(filters.selectedStatus).join(","));

  if (filters.selectedContinents.size > 0)
    p.set("continents", Array.from(filters.selectedContinents).join(","));

  if (filters.selectedCountries.size > 0)
    p.set("countries", Array.from(filters.selectedCountries).join(","));

  if (filters.continentMode !== def.continentMode)
    p.set("cmode", filters.continentMode);

  if (filters.intercontinentalMode !== def.intercontinentalMode)
    p.set("inter", filters.intercontinentalMode);

  if (filters.yearRange[0] !== meta.yearMin)
    p.set("ymin", String(filters.yearRange[0]));

  if (filters.yearRange[1] !== meta.yearMax)
    p.set("ymax", String(filters.yearRange[1]));

  if (filters.countrySearch) p.set("q", filters.countrySearch);

  if (filters.selectedCountryIso3)
    p.set("country", filters.selectedCountryIso3);

  if (filters.includeOrgAgreements) p.set("org", "1");

  return p;
}

export function searchParamsToFilters(
  params: URLSearchParams,
  meta: DataMeta
): FilterState {
  const def = defaultFilters(meta);

  const types = params.get("types");
  if (types) def.selectedTypes = new Set(types.split(","));

  const status = params.get("status");
  if (status) def.selectedStatus = new Set(status.split(","));

  const continents = params.get("continents");
  if (continents) def.selectedContinents = new Set(continents.split(","));

  const countries = params.get("countries");
  if (countries) def.selectedCountries = new Set(countries.split(","));

  const cmode = params.get("cmode") as FilterState["continentMode"] | null;
  if (cmode && ["either", "both", "src", "dst"].includes(cmode))
    def.continentMode = cmode;

  const inter = params.get("inter") as FilterState["intercontinentalMode"] | null;
  if (inter && ["all", "inter", "intra"].includes(inter))
    def.intercontinentalMode = inter;

  const ymin = params.get("ymin");
  if (ymin) def.yearRange[0] = Math.max(meta.yearMin, Number(ymin) || meta.yearMin);

  const ymax = params.get("ymax");
  if (ymax) def.yearRange[1] = Math.min(meta.yearMax, Number(ymax) || meta.yearMax);

  const q = params.get("q");
  if (q) def.countrySearch = q;

  const country = params.get("country");
  if (country) def.selectedCountryIso3 = country;

  if (params.get("org") === "1") def.includeOrgAgreements = true;

  return def;
}

export function syncFiltersToUrl(filters: FilterState, meta: DataMeta): void {
  const params = filtersToSearchParams(filters, meta);
  const search = params.toString();
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}
