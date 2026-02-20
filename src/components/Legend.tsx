import { memo, useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { getTypeColor } from "@/lib/colors";

interface LegendProps {
  allTypes: string[];
}

function LegendInner({ allTypes }: LegendProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="glass-panel p-2.5 text-[#827875] hover:text-[#3790C9] transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
          title="Show legend"
        >
          <Info size={14} />
          <span className="hidden sm:inline">Legend</span>
        </button>
      ) : (
        <div className="glass-panel w-52 max-h-64 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#827875]/15">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3790C9]">
              <Info size={13} />
              Legend
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#827875] hover:text-[#3790C9] p-0.5 cursor-pointer"
            >
              <ChevronDown size={13} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-3 py-2 space-y-3 scrollbar-thin">
            <section>
              <div className="text-[9px] font-semibold text-[#827875] uppercase tracking-wider mb-1.5">
                Agreement Types
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {allTypes.map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getTypeColor(t) }}
                    />
                    <span className="text-[10px] text-[#3a3635] truncate">
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="text-[9px] font-semibold text-[#827875] uppercase tracking-wider mb-1.5">
                Points
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#3790C9] opacity-70" />
                  <span className="text-[10px] text-[#3a3635]">Country</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#41A0D8]" />
                  <span className="text-[10px] text-[#3a3635]">Hovered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#1a4f7a]" />
                  <span className="text-[10px] text-[#3a3635]">Selected</span>
                </div>
              </div>
            </section>

            <section>
              <div className="text-[9px] font-semibold text-[#827875] uppercase tracking-wider mb-1.5">
                Arcs
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] flex-shrink-0 rounded bg-[#827875] opacity-20" />
                  <span className="text-[10px] text-[#3a3635]">Default</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] flex-shrink-0 rounded bg-[#3790C9] opacity-70" />
                  <span className="text-[10px] text-[#3a3635]">Highlighted</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

const Legend = memo(LegendInner);
export default Legend;
