import { memo, useCallback, useMemo, useState } from "react";
import {
  Filter,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  X,
  Search,
} from "lucide-react";
import type { FilterState, DataMeta } from "@/lib/data";
import { getTypeColor } from "@/lib/colors";

interface FiltersPanelProps {
  filters: FilterState;
  meta: DataMeta;
  countryOptions: string[];
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
}

function FiltersPanelInner({
  filters,
  meta,
  countryOptions,
  onChange,
  onClear,
}: FiltersPanelProps) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
  const [typesOpen, setTypesOpen] = useState(false);
  const [continentsOpen, setContinentsOpen] = useState(false);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const toggleSet = useCallback(
    (key: "selectedTypes" | "selectedStatus" | "selectedContinents", value: string) => {
      const current = new Set(filters[key]);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      onChange({ [key]: current });
    },
    [filters, onChange]
  );

  const filteredCountryOptions = useMemo(
    () => countryOptions.filter((name) =>
      name.toLowerCase().includes(countryQuery.trim().toLowerCase())
    ),
    [countryOptions, countryQuery]
  );

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 left-4 z-20 glass-panel p-3 text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer"
        title="Open filters"
      >
        <ChevronRight size={20} />
      </button>
    );
  }

  const continentModes: FilterState["continentMode"][] = [
    "either",
    "both",
    "src",
    "dst",
  ];
  const interModes: { val: FilterState["intercontinentalMode"]; label: string }[] = [
    { val: "all", label: "All" },
    { val: "inter", label: "Inter" },
    { val: "intra", label: "Intra" },
  ];

  const statusLabels: Record<string, string> = {
    IN_FORCE: "In Force",
    SIGNED_NOT_IN_FORCE: "Signed",
    TERMINATED: "Terminated",
    UNKNOWN: "Unknown",
  };

  const hasActiveFilters =
    filters.selectedTypes.size > 0 ||
    filters.selectedStatus.size > 0 ||
    filters.selectedContinents.size > 0 ||
    filters.selectedCountries.size > 0 ||
    filters.intercontinentalMode !== "all" ||
    filters.countrySearch.length > 0 ||
    filters.yearRange[0] !== meta.yearMin ||
    filters.yearRange[1] !== meta.yearMax ||
    filters.includeOrgAgreements;
  const selectedTypes = Array.from(filters.selectedTypes);
  const selectedContinents = Array.from(filters.selectedContinents);
  const selectedCountries = Array.from(filters.selectedCountries);

  return (
    <div className="absolute top-4 left-4 z-20 glass-panel w-64 sm:w-72 max-h-[calc(100vh-32px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#827875]/15">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#3790C9]">
          <Filter size={16} />
          Filters
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="text-xs text-red-500 hover:text-red-600 px-2 py-1 cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className="text-[#827875] hover:text-[#3790C9] p-1 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5 scrollbar-thin">
        {/* Agreement Types */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Agreement Type
          </h3>
          <button
            onClick={() => setTypesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#827875]/20 bg-white/60 text-xs text-[#3a3635] hover:border-[#3790C9]/40 transition-colors cursor-pointer"
          >
            <span>
              {selectedTypes.length > 0
                ? `${selectedTypes.length} selected`
                : "Select agreement types"}
            </span>
            {typesOpen ? (
              <ChevronDown size={14} className="text-[#827875]" />
            ) : (
              <ChevronRight size={14} className="text-[#827875]" />
            )}
          </button>
          {selectedTypes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedTypes.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md text-[10px] border border-current/30"
                  style={{ color: getTypeColor(t) }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div
            className={`mt-2 overflow-y-auto transition-all duration-200 ${
              typesOpen ? "max-h-44 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="space-y-1 pr-1">
              {meta.allTypes.map((t) => (
                <label
                  key={t}
                  className="flex items-center justify-between gap-2 text-xs cursor-pointer text-[#3a3635] hover:text-[#3790C9] transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getTypeColor(t) }}
                    />
                    <span className="truncate">{t}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={filters.selectedTypes.has(t)}
                    onChange={() => toggleSet("selectedTypes", t)}
                    className="accent-[#3790C9] w-3.5 h-3.5 flex-shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Status */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Status
          </h3>
          <div className="space-y-1">
            {meta.allStatuses.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-xs cursor-pointer text-[#3a3635] hover:text-[#3790C9] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.selectedStatus.has(s)}
                  onChange={() => toggleSet("selectedStatus", s)}
                  className="accent-[#3790C9] w-3.5 h-3.5"
                />
                <span>{statusLabels[s] || s}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ORG Agreements */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Organization Agreements
          </h3>
          <label className="flex items-center gap-2 text-xs cursor-pointer text-[#3a3635] hover:text-[#3790C9] transition-colors">
            <input
              type="checkbox"
              checked={filters.includeOrgAgreements}
              onChange={() =>
                onChange({ includeOrgAgreements: !filters.includeOrgAgreements })
              }
              className="accent-[#3790C9] w-3.5 h-3.5"
            />
            <span>Include ORG-party agreements</span>
          </label>
          <p className="text-[10px] text-[#827875] mt-1 leading-relaxed">
            Show agreements involving organizations (EU, EFTA, MERCOSUR, etc.) mapped to their HQ locations
          </p>
        </section>

        {/* Continents */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Continents
          </h3>
          <button
            onClick={() => setContinentsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#827875]/20 bg-white/60 text-xs text-[#3a3635] hover:border-[#3790C9]/40 transition-colors cursor-pointer"
          >
            <span>
              {selectedContinents.length > 0
                ? `${selectedContinents.length} selected`
                : "Select continents"}
            </span>
            {continentsOpen ? (
              <ChevronDown size={14} className="text-[#827875]" />
            ) : (
              <ChevronRight size={14} className="text-[#827875]" />
            )}
          </button>
          {selectedContinents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedContinents.map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 rounded-md text-[10px] border border-[#3790C9]/30 text-[#3790C9]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          <div
            className={`mt-2 overflow-y-auto transition-all duration-200 ${
              continentsOpen
                ? "max-h-36 opacity-100"
                : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="space-y-1 pr-1">
              {meta.allContinents.map((c) => (
                <label
                  key={c}
                  className="flex items-center justify-between gap-2 text-xs cursor-pointer text-[#3a3635] hover:text-[#3790C9] transition-colors"
                >
                  <span>{c}</span>
                  <input
                    type="checkbox"
                    checked={filters.selectedContinents.has(c)}
                    onChange={() => toggleSet("selectedContinents", c)}
                    className="accent-[#3790C9] w-3.5 h-3.5 flex-shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            {continentModes.map((m) => (
              <button
                key={m}
                onClick={() => onChange({ continentMode: m })}
                className={`px-2 py-0.5 text-[10px] rounded-md cursor-pointer transition-colors ${
                  filters.continentMode === m
                    ? "bg-[#3790C9]/15 text-[#3790C9] font-medium"
                    : "bg-[#827875]/8 text-[#827875] hover:text-[#3790C9]"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Intercontinental */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Intercontinental
          </h3>
          <div className="flex gap-1">
            {interModes.map(({ val, label }) => (
              <button
                key={val}
                onClick={() => onChange({ intercontinentalMode: val })}
                className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                  filters.intercontinentalMode === val
                    ? "bg-[#3790C9]/15 text-[#3790C9] font-medium"
                    : "bg-[#827875]/8 text-[#827875] hover:text-[#3790C9]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Year Range */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Signature Year
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-[#827875]">
                From
                <input
                  type="number"
                  min={meta.yearMin}
                  max={filters.yearRange[1]}
                  value={filters.yearRange[0]}
                  onChange={(e) =>
                    onChange({
                      yearRange: [
                        Math.min(
                          Math.max(Number(e.target.value) || meta.yearMin, meta.yearMin),
                          filters.yearRange[1]
                        ),
                        filters.yearRange[1],
                      ],
                    })
                  }
                  className="mt-1 w-full bg-white/60 border border-[#827875]/20 rounded-lg px-2 py-1 text-xs text-[#3a3635] outline-none focus:border-[#3790C9]/40 transition-colors"
                />
              </label>
              <label className="text-[10px] text-[#827875]">
                To
                <input
                  type="number"
                  min={filters.yearRange[0]}
                  max={meta.yearMax}
                  value={filters.yearRange[1]}
                  onChange={(e) =>
                    onChange({
                      yearRange: [
                        filters.yearRange[0],
                        Math.max(
                          Math.min(Number(e.target.value) || meta.yearMax, meta.yearMax),
                          filters.yearRange[0]
                        ),
                      ],
                    })
                  }
                  className="mt-1 w-full bg-white/60 border border-[#827875]/20 rounded-lg px-2 py-1 text-xs text-[#3a3635] outline-none focus:border-[#3790C9]/40 transition-colors"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onChange({ yearRange: [meta.yearMin, meta.yearMax] })}
                className="px-2 py-0.5 text-[10px] rounded-md bg-[#827875]/8 text-[#827875] hover:text-[#3790C9] cursor-pointer transition-colors"
              >
                All
              </button>
              <button
                onClick={() =>
                  onChange({
                    yearRange: [Math.max(meta.yearMin, meta.yearMax - 10), meta.yearMax],
                  })
                }
                className="px-2 py-0.5 text-[10px] rounded-md bg-[#827875]/8 text-[#827875] hover:text-[#3790C9] cursor-pointer transition-colors"
              >
                Last 10y
              </button>
              <button
                onClick={() =>
                  onChange({
                    yearRange: [Math.max(meta.yearMin, meta.yearMax - 20), meta.yearMax],
                  })
                }
                className="px-2 py-0.5 text-[10px] rounded-md bg-[#827875]/8 text-[#827875] hover:text-[#3790C9] cursor-pointer transition-colors"
              >
                Last 20y
              </button>
            </div>
          </div>
        </section>

        {/* Country Selection */}
        <section>
          <h3 className="text-xs font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Country
          </h3>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#827875] pointer-events-none"
            />
            <input
              type="text"
              placeholder={selectedCountries.length > 0 ? `${selectedCountries.length} selected — search more` : "Search countries..."}
              value={countryQuery}
              onFocus={() => setCountriesOpen(true)}
              onChange={(e) => { setCountryQuery(e.target.value); setCountriesOpen(true); }}
              className="w-full bg-white/60 border border-[#827875]/20 rounded-lg pl-8 pr-8 py-2 text-xs text-[#3a3635] placeholder-[#827875] outline-none focus:border-[#3790C9]/40 transition-colors"
            />
            {countryQuery ? (
              <button
                onClick={() => setCountryQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#827875] hover:text-[#3790C9] cursor-pointer"
              >
                <X size={12} />
              </button>
            ) : (
              <button
                onClick={() => setCountriesOpen((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#827875] cursor-pointer"
              >
                {countriesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>
          {selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedCountries.slice(0, 8).map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded-md text-[10px] border border-[#3790C9]/30 text-[#3790C9]"
                >
                  {name}
                </span>
              ))}
              {selectedCountries.length > 8 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] border border-[#827875]/20 text-[#827875]">
                  +{selectedCountries.length - 8}
                </span>
              )}
            </div>
          )}
          <div
            className={`mt-2 overflow-y-auto transition-all duration-200 ${
              countriesOpen
                ? "max-h-48 opacity-100"
                : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="space-y-1 pr-1 max-h-40 overflow-y-auto scrollbar-thin">
              {filteredCountryOptions.map((name) => (
                <label
                  key={name}
                  className="flex items-center justify-between gap-2 text-xs cursor-pointer text-[#3a3635] hover:text-[#3790C9] transition-colors"
                >
                  <span className="truncate">{name}</span>
                  <input
                    type="checkbox"
                    checked={filters.selectedCountries.has(name)}
                    onChange={() => {
                      const current = new Set(filters.selectedCountries);
                      if (current.has(name)) current.delete(name);
                      else current.add(name);
                      onChange({ selectedCountries: current, countrySearch: "" });
                    }}
                    className="accent-[#3790C9] w-3.5 h-3.5 flex-shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const FiltersPanel = memo(FiltersPanelInner);
export default FiltersPanel;
