import { memo, useMemo, useState } from "react";
import { FileText, X, ChevronDown } from "lucide-react";
import type { Edge } from "@/lib/data";
import { getTypeColor } from "@/lib/colors";

interface AgreementDetailPanelProps {
  edges: Edge[];
  selectedCountryIso3: string;
  countryName: string;
  onClose: () => void;
  panelBottomClass?: string;
}

const STATUS_LABELS: Record<string, string> = {
  IN_FORCE: "In Force",
  SIGNED_NOT_IN_FORCE: "Signed",
  TERMINATED: "Terminated",
  UNKNOWN: "Unknown",
};

function AgreementDetailPanelInner({
  edges,
  selectedCountryIso3,
  countryName,
  onClose,
  panelBottomClass = "bottom-14",
}: AgreementDetailPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const connected = useMemo(() => {
    const seen = new Set<number>();
    const result: { edge: Edge; otherParty: string }[] = [];
    for (const e of edges) {
      if (seen.has(e.agreement_id)) continue;
      if (e.src_iso3 === selectedCountryIso3 || e.dst_iso3 === selectedCountryIso3) {
        seen.add(e.agreement_id);
        const other =
          e.src_iso3 === selectedCountryIso3 ? e.dst_name : e.src_name;
        result.push({ edge: e, otherParty: other });
      }
    }
    return result.sort(
      (a, b) => (b.edge.signature_year || 0) - (a.edge.signature_year || 0)
    );
  }, [edges, selectedCountryIso3]);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`absolute ${panelBottomClass} right-4 z-20 glass-panel p-3 text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer`}
        title="Show agreements"
      >
        <FileText size={20} />
      </button>
    );
  }

  return (
    <div className={`absolute ${panelBottomClass} right-4 z-20 glass-panel w-72 max-h-[50vh] flex flex-col`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#827875]/15">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#3790C9] min-w-0">
          <FileText size={14} className="flex-shrink-0" />
          <span className="truncate">{countryName}</span>
          <span className="text-[#827875] font-normal flex-shrink-0">
            ({connected.length})
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setExpanded(false)}
            className="text-[#827875] hover:text-[#3790C9] p-1 cursor-pointer"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={onClose}
            className="text-[#827875] hover:text-red-500 p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 scrollbar-thin">
        {connected.length === 0 ? (
          <div className="px-4 py-4 text-xs text-[#827875] text-center">
            No agreements in current filter view.
          </div>
        ) : (
          connected.map(({ edge, otherParty }, i) => (
            <div
              key={`${edge.agreement_id}-${i}`}
              className="px-4 py-2.5 border-b border-[#827875]/8 last:border-b-0 hover:bg-[#3790C9]/3 transition-colors"
            >
              <div className="text-xs font-medium text-[#3a3635] leading-snug mb-1">
                {edge.short_title}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#827875]">
                <span
                  className="font-semibold"
                  style={{ color: getTypeColor(edge.agreement_type_code) }}
                >
                  {edge.agreement_type_code}
                </span>
                <span>{edge.signature_date || "N/A"}</span>
                <span>{STATUS_LABELS[edge.status_code] || edge.status_text}</span>
              </div>
              <div className="text-[10px] text-[#827875] mt-0.5">
                with {otherParty}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const AgreementDetailPanel = memo(AgreementDetailPanelInner);
export default AgreementDetailPanel;
