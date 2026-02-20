import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import type { Edge } from "@/lib/data";
import { getTypeColor } from "@/lib/colors";

function useAnimatedCount(target: number, durationMs = 1200): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);

  return display;
}

function AnimatedCounts({ edgeCount, totalEdges, agreementCount }: { edgeCount: number; totalEdges: number; agreementCount: number }) {
  const animEdges = useAnimatedCount(edgeCount);
  const animAgreements = useAnimatedCount(agreementCount);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-lg font-bold text-[#3a3635]">
          {animEdges.toLocaleString()}
        </div>
        <div className="text-[10px] text-[#827875]">
          of {totalEdges.toLocaleString()} edges
        </div>
      </div>
      <div>
        <div className="text-lg font-bold text-[#3a3635]">
          {animAgreements.toLocaleString()}
        </div>
        <div className="text-[10px] text-[#827875]">agreements</div>
      </div>
    </div>
  );
}

interface StatsPanelProps {
  filteredEdges: Edge[];
  totalEdges: number;
}

function StatsPanelInner({ filteredEdges, totalEdges }: StatsPanelProps) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  const stats = useMemo(() => {
    const agreementIds = new Set<number>();
    const typeCounts: Record<string, number> = {};
    const countryCounts: Record<string, { name: string; count: number }> = {};

    for (const e of filteredEdges) {
      agreementIds.add(e.agreement_id);
      typeCounts[e.agreement_type_code] =
        (typeCounts[e.agreement_type_code] || 0) + 1;

      for (const [iso, name] of [
        [e.src_iso3, e.src_name],
        [e.dst_iso3, e.dst_name],
      ] as const) {
        if (iso.startsWith("ORG_")) continue;
        if (!countryCounts[iso])
          countryCounts[iso] = { name, count: 0 };
        countryCounts[iso].count++;
      }
    }

    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);

    const topCountries = Object.entries(countryCounts)
      .map(([iso, v]) => ({ iso, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    return {
      uniqueAgreements: agreementIds.size,
      topTypes,
      topCountries,
    };
  }, [filteredEdges]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 right-4 z-20 glass-panel p-3 text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer"
        title="Open stats"
      >
        <ChevronLeft size={20} />
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-20 glass-panel w-56 max-h-[calc(100vh-32px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#827875]/15">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#3790C9]">
          <BarChart3 size={16} />
          Stats
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[#827875] hover:text-[#3790C9] p-1 cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4 scrollbar-thin">
        {/* Counts */}
        <AnimatedCounts
          edgeCount={filteredEdges.length}
          totalEdges={totalEdges}
          agreementCount={stats.uniqueAgreements}
        />

        {/* Top Types */}
        <section>
          <h3 className="text-[10px] font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Top Types
          </h3>
          <div className="space-y-1.5">
            {stats.topTypes.map(([type, count]) => {
              const pct = totalEdges > 0 ? (count / totalEdges) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: getTypeColor(type) }}>{type}</span>
                    <span className="text-[#827875]">{count}</span>
                  </div>
                  <div className="h-1 bg-[#827875]/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: getTypeColor(type),
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Countries */}
        <section>
          <h3 className="text-[10px] font-semibold text-[#827875] uppercase tracking-wider mb-2">
            Top Countries
          </h3>
          <div className="space-y-1">
            {stats.topCountries.map((c) => (
              <div
                key={c.iso}
                className="flex justify-between text-xs"
              >
                <span className="text-[#3a3635] truncate mr-2">{c.name}</span>
                <span className="text-[#3790C9] flex-shrink-0">{c.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const StatsPanel = memo(StatsPanelInner);
export default StatsPanel;
