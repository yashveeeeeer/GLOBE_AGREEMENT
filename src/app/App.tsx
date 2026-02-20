import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Edge, CountryIndex, FilterState, DataMeta } from "@/lib/data";
import { extractMeta, defaultFilters } from "@/lib/data";
import { filterEdges } from "@/lib/filtering";
import { searchParamsToFilters, syncFiltersToUrl } from "@/lib/urlState";
import GlobeView from "@/components/GlobeView";
import FiltersPanel from "@/components/FiltersPanel";
import StatsPanel from "@/components/StatsPanel";
import AgreementDetailPanel from "@/components/AgreementDetailPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Globe, Loader } from "lucide-react";

export default function App() {
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [countries, setCountries] = useState<CountryIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [edgesRes, countriesRes] = await Promise.all([
          fetch("/data/agreements_edges.json"),
          fetch("/data/countries_index.json"),
        ]);

        if (!edgesRes.ok) throw new Error(`Failed to load edges: ${edgesRes.status}`);
        if (!countriesRes.ok) throw new Error(`Failed to load countries: ${countriesRes.status}`);

        const edgesData: Edge[] = await edgesRes.json();
        const countriesData: CountryIndex[] = await countriesRes.json();

        if (cancelled) return;

        setAllEdges(edgesData);
        setCountries(countriesData);

        const m = extractMeta(edgesData);
        setMeta(m);
        const urlParams = new URLSearchParams(window.location.search);
        setFilters(
          urlParams.toString()
            ? searchParamsToFilters(urlParams, m)
            : defaultFilters(m)
        );
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const urlSyncTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!filters || !meta) return;
    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => syncFiltersToUrl(filters, meta), 300);
    return () => {
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    };
  }, [filters, meta]);

  const filteredEdges = useMemo(() => {
    if (!filters) return allEdges;
    return filterEdges(allEdges, filters);
  }, [allEdges, filters]);

  const countryOptions = useMemo(
    () =>
      countries
        .filter((c) => !c.iso3.startsWith("ORG_"))
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b)),
    [countries]
  );

  const selectedAgreementCount = useMemo(() => {
    const iso3 = filters?.selectedCountryIso3;
    if (!iso3) return 0;
    const ids = new Set<number>();
    for (const e of filteredEdges) {
      if (e.src_iso3 === iso3 || e.dst_iso3 === iso3) ids.add(e.agreement_id);
    }
    return ids.size;
  }, [filters?.selectedCountryIso3, filteredEdges]);

  const handleFilterChange = useCallback(
    (patch: Partial<FilterState>) => {
      setFilters((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    if (meta) setFilters(defaultFilters(meta));
  }, [meta]);

  const handleSelectCountry = useCallback((iso3: string | null) => {
    setFilters((prev) =>
      prev ? { ...prev, selectedCountryIso3: iso3 } : prev
    );
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF9F6]">
        <Globe size={48} className="text-[#3790C9] mb-4 animate-pulse" />
        <div className="text-[#3790C9] text-lg font-semibold mb-2">
          International Investment Agreements Navigator
        </div>
        <div className="flex items-center gap-2 text-[#827875] text-sm">
          <Loader size={14} className="animate-spin" />
          Fetching agreements and country data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF9F6]">
        <div className="text-red-500 text-lg font-semibold mb-2">
          Failed to Load Data
        </div>
        <div className="text-[#827875] text-sm mb-4">{error}</div>
        <div className="text-[#827875] text-xs">
          Run <code className="text-[#3790C9]">npm run setup</code> to generate
          the data files.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#FAF9F6]">
      <ErrorBoundary>
        <GlobeView
          edges={filteredEdges}
          selectedCountryIso3={filters?.selectedCountryIso3 ?? null}
          onSelectCountry={handleSelectCountry}
        />
      </ErrorBoundary>

      {filters && meta && (
        <FiltersPanel
          filters={filters}
          meta={meta}
          countryOptions={countryOptions}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      )}

      <StatsPanel
        filteredEdges={filteredEdges}
        totalEdges={allEdges.length}
      />

      {filters?.selectedCountryIso3 && (
        <AgreementDetailPanel
          edges={filteredEdges}
          selectedCountryIso3={filters.selectedCountryIso3}
          panelBottomClass="bottom-24"
          countryName={
            countries.find((c) => c.iso3 === filters.selectedCountryIso3)
              ?.name || filters.selectedCountryIso3
          }
          onClose={() => handleSelectCountry(null)}
        />
      )}

      {filters?.selectedCountryIso3 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 glass-panel px-5 py-2 flex items-center gap-3">
          <span className="text-sm text-[#3a3635] whitespace-nowrap">
            Selected:{" "}
            <span className="font-semibold text-[#3790C9]">
              {countries.find(
                (c) => c.iso3 === filters.selectedCountryIso3
              )?.name || filters.selectedCountryIso3}
            </span>
            <span className="text-[#827875]"> • {selectedAgreementCount} agreements</span>
          </span>
          <span className="hidden md:inline text-xs text-[#827875]">
            See right panel for agreement names
          </span>
          <button
            onClick={() => handleSelectCountry(null)}
            className="text-[#827875] hover:text-[#3790C9] text-xs cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
        <span className="text-[#3790C9]/60 text-xs font-semibold tracking-[0.12em] uppercase">
          International Investment Agreements Navigator
        </span>
      </div>

      {filteredEdges.length === 0 && !loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 glass-panel px-8 py-6 text-center">
          <div className="text-[#827875] text-sm mb-2">
            No agreements match the current filters.
          </div>
          <button
            onClick={handleClearFilters}
            className="text-[#3790C9] text-xs hover:text-[#41A0D8] cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
