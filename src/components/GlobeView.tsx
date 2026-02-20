import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  memo,
} from "react";
import Globe from "react-globe.gl";

interface GlobeHandle {
  pointOfView(): { lat: number; lng: number; altitude: number };
  pointOfView(pov: { lat?: number; lng?: number; altitude?: number }, transitionMs?: number): void;
  controls(): GlobeControls;
  renderer(): { setPixelRatio(ratio: number): void };
}

interface GlobeControls {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  dampingFactor: number;
  rotateSpeed: number;
  zoomSpeed: number;
  minDistance: number;
  maxDistance: number;
  addEventListener?(event: string, fn: () => void): void;
  removeEventListener?(event: string, fn: () => void): void;
}

import type { Edge, PointDatum } from "@/lib/data";
import { buildPointsFromEdges, spreadOverlappingPoints } from "@/lib/data";
import {
  getTypeColor,
  getTypeColorRgba,
  getTypeColorRgbaNight,
  NIGHT_BG,
  NIGHT_ATMOSPHERE,
  NIGHT_ARC_HIGHLIGHT,
  DAY_POINT_SELECTED,
  DAY_POINT_CONNECTED,
  DAY_POINT_UNCONNECTED,
  NIGHT_POINT_SELECTED,
  NIGHT_POINT_CONNECTED,
  NIGHT_POINT_UNCONNECTED,
} from "@/lib/colors";
import { isEdgeConnectedToCountry } from "@/lib/filtering";
import { isMobile, isSmallScreen } from "@/lib/mobile";
import { RotateCcw, Sun, Moon } from "lucide-react";

interface GlobeViewProps {
  edges: Edge[];
  selectedCountryIso3: string | null;
  onSelectCountry: (iso3: string | null) => void;
  nightMode: boolean;
  onToggleNightMode: () => void;
}

const ARC_HIGHLIGHT = "rgba(55, 144, 201, 0.60)";
const POINT_COLOR = "#3790C9";
const SPREAD_THRESHOLD = 1.5;
const ANIM_REVEAL_MS = 1500;
const ANIM_MAX_STEPS = 30;

function geoBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = Math.PI / 180;
  const dL = (lng2 - lng1) * R;
  const y = Math.sin(dL) * Math.cos(lat2 * R);
  const x = Math.cos(lat1 * R) * Math.sin(lat2 * R)
          - Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos(dL);
  return (Math.atan2(y, x) / R + 360) % 360;
}

function sortEdgesByBearing(iso3: string, lat: number, lng: number, allEdges: Edge[]): Edge[] {
  const connected = allEdges.filter(
    e => e.src_iso3 === iso3 || e.dst_iso3 === iso3
  );
  return connected.sort((a, b) => {
    const aB = a.src_iso3 === iso3
      ? geoBearing(lat, lng, a.dst_lat, a.dst_lng)
      : geoBearing(lat, lng, a.src_lat, a.src_lng);
    const bB = b.src_iso3 === iso3
      ? geoBearing(lat, lng, b.dst_lat, b.dst_lng)
      : geoBearing(lat, lng, b.src_lat, b.src_lng);
    return aB - bB;
  });
}

function GlobeViewInner({
  edges,
  selectedCountryIso3,
  onSelectCountry,
  nightMode,
  onToggleNightMode,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomedIn, setZoomedIn] = useState(false);
  const [arcTick, setArcTick] = useState(0);

  const animPhaseRef = useRef<"idle" | "centering" | "revealing" | "selected" | "hiding" | "resetting">("idle");
  const sortedArcsRef = useRef<Edge[]>([]);
  const revealedIdsRef = useRef(new Set<string>());
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightIso3 = selectedCountryIso3;

  const connectedIso3s = useMemo(() => {
    if (!highlightIso3) return null;
    const set = new Set<string>();
    for (const e of edges) {
      if (e.src_iso3 === highlightIso3) set.add(e.dst_iso3);
      else if (e.dst_iso3 === highlightIso3) set.add(e.src_iso3);
    }
    return set;
  }, [edges, highlightIso3]);

  const points: PointDatum[] = useMemo(
    () => buildPointsFromEdges(edges),
    [edges]
  );

  const displayPoints = useMemo(
    () => spreadOverlappingPoints(points, zoomedIn),
    [points, zoomedIn]
  );

  const displayArcs = useMemo(() => {
    void arcTick;
    if (!highlightIso3) return edges;
    const revealed = revealedIdsRef.current;
    if (revealed.size === 0) return [];
    const result: Edge[] = [];
    for (const e of edges) {
      if (isEdgeConnectedToCountry(e, highlightIso3) && revealed.has(e.edge_id)) {
        result.push(e);
      }
    }
    return result;
  }, [edges, highlightIso3, arcTick]);

  // ── Animation helpers ──────────────────────────────────────────────

  const cancelAnim = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    animPhaseRef.current = "idle";
    revealedIdsRef.current = new Set();
    sortedArcsRef.current = [];
  }, []);

  const startReveal = useCallback(() => {
    const arcs = sortedArcsRef.current;
    const total = arcs.length;
    if (total === 0) { animPhaseRef.current = "selected"; return; }
    const batchSize = Math.max(1, Math.ceil(total / ANIM_MAX_STEPS));
    const stepMs = ANIM_REVEAL_MS / Math.ceil(total / batchSize);
    let idx = 0;
    animPhaseRef.current = "revealing";

    function step() {
      const end = Math.min(idx + batchSize, total);
      const next = new Set(revealedIdsRef.current);
      for (let i = idx; i < end; i++) next.add(arcs[i].edge_id);
      revealedIdsRef.current = next;
      idx = end;
      setArcTick(t => t + 1);
      if (idx < total) {
        animTimerRef.current = setTimeout(step, stepMs);
      } else {
        animPhaseRef.current = "selected";
        animTimerRef.current = null;
      }
    }
    step();
  }, []);

  const startHide = useCallback((onDone: () => void) => {
    const arcs = sortedArcsRef.current;
    const total = arcs.length;
    if (total === 0) { onDone(); return; }
    const batchSize = Math.max(1, Math.ceil(total / ANIM_MAX_STEPS));
    const stepMs = ANIM_REVEAL_MS / Math.ceil(total / batchSize);
    let remaining = total;
    animPhaseRef.current = "hiding";

    function step() {
      const start = Math.max(0, remaining - batchSize);
      const next = new Set(revealedIdsRef.current);
      for (let i = remaining - 1; i >= start; i--) next.delete(arcs[i].edge_id);
      revealedIdsRef.current = next;
      remaining = start;
      setArcTick(t => t + 1);
      if (remaining > 0) {
        animTimerRef.current = setTimeout(step, stepMs);
      } else {
        animTimerRef.current = null;
        onDone();
      }
    }
    step();
  }, []);

  // Sync revealed set when edges change during "selected" state (e.g. filter change)
  useEffect(() => {
    if (animPhaseRef.current === "selected" && highlightIso3) {
      const connected = edges.filter(e => isEdgeConnectedToCountry(e, highlightIso3));
      revealedIdsRef.current = new Set(connected.map(e => e.edge_id));
      sortedArcsRef.current = connected;
      setArcTick(t => t + 1);
    }
  }, [edges, highlightIso3]);

  // Clean up on external deselect (e.g. Clear button)
  useEffect(() => {
    if (!selectedCountryIso3 && animPhaseRef.current !== "idle") {
      cancelAnim();
    }
  }, [selectedCountryIso3, cancelAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); };
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    ro.observe(el);
    setDimensions({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Controls init + zoom tracking
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      controls.enableDamping = true;
      controls.dampingFactor = isMobile ? 0.25 : 0.15;
      controls.rotateSpeed = isMobile ? 0.4 : 0.6;
      controls.zoomSpeed = isMobile ? 0.5 : 0.8;
      controls.minDistance = isMobile ? 150 : 120;
      controls.maxDistance = 600;
    }
    globe.pointOfView({ lat: 20, lng: 0, altitude: isSmallScreen ? 3.5 : 2.5 });

    const onControlChange = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        try {
          const pov = globe.pointOfView();
          const nowZoomed = pov.altitude < SPREAD_THRESHOLD;
          setZoomedIn((prev) => (prev !== nowZoomed ? nowZoomed : prev));
        } catch (_) {}
      });
    };

    controls.addEventListener?.("change", onControlChange);
    return () => {
      controls.removeEventListener?.("change", onControlChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Pixel ratio cap
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const timer = setTimeout(() => {
      try {
        const renderer = globe.renderer();
        if (!renderer) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      } catch (_) {}
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Pause auto-rotation only when the cursor is over the WebGL canvas itself
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const canvas = el.querySelector("canvas");
    if (!canvas) return;

    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const onEnter = () => {
      if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
      const globe = globeRef.current;
      if (globe) {
        const c = globe.controls();
        if (c) c.autoRotate = false;
      }
    };

    const onLeave = () => {
      resumeTimer = setTimeout(() => {
        const globe = globeRef.current;
        if (globe) {
          const c = globe.controls();
          if (c) c.autoRotate = true;
        }
      }, 300);
    };

    canvas.addEventListener("mouseenter", onEnter);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchstart", onEnter, { passive: true });
    canvas.addEventListener("touchend", onLeave, { passive: true });
    return () => {
      canvas.removeEventListener("mouseenter", onEnter);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("touchstart", onEnter);
      canvas.removeEventListener("touchend", onLeave);
      if (resumeTimer) clearTimeout(resumeTimer);
    };
  }, []);

  // ── Point callbacks (native WebGL) ──────────────────────────────────

  const pointColorFn = useCallback(
    (d: object) => {
      const p = d as PointDatum;
      if (!highlightIso3) return nightMode ? "#ffffff" : POINT_COLOR;
      if (p.iso3 === highlightIso3)
        return nightMode ? NIGHT_POINT_SELECTED : DAY_POINT_SELECTED;
      if (connectedIso3s?.has(p.iso3))
        return nightMode ? NIGHT_POINT_CONNECTED : DAY_POINT_CONNECTED;
      return nightMode ? NIGHT_POINT_UNCONNECTED : DAY_POINT_UNCONNECTED;
    },
    [highlightIso3, nightMode, connectedIso3s]
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as PointDatum;
      cancelAnim();

      if (selectedCountryIso3 === p.iso3) {
        // Deselect: defer sort to next frame, then run hide animation
        animPhaseRef.current = "hiding";
        requestAnimationFrame(() => {
          const sorted = sortEdgesByBearing(p.iso3, p.lat, p.lng, edges);
          sortedArcsRef.current = sorted;
          revealedIdsRef.current = new Set(sorted.map(e => e.edge_id));
          setArcTick(t => t + 1);

          startHide(() => {
            onSelectCountry(null);
            animPhaseRef.current = "resetting";
            setArcTick(t => t + 1);
            const globe = globeRef.current;
            if (globe) globe.pointOfView({ lat: 20, lng: 0, altitude: isSmallScreen ? 3.5 : 2.5 }, 1000);
            animTimerRef.current = setTimeout(() => {
              animPhaseRef.current = "idle";
              animTimerRef.current = null;
            }, 1000);
          });
        });
      } else {
        // Select: start camera immediately, defer heavy work to next frame
        animPhaseRef.current = "centering";
        const globe = globeRef.current;
        if (globe) globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 2 }, 1000);

        requestAnimationFrame(() => {
          onSelectCountry(p.iso3);
          sortedArcsRef.current = sortEdgesByBearing(p.iso3, p.lat, p.lng, edges);
          revealedIdsRef.current = new Set();
          setArcTick(t => t + 1);

          animTimerRef.current = setTimeout(() => {
            startReveal();
          }, 1000);
        });
      }
    },
    [selectedCountryIso3, onSelectCountry, edges, cancelAnim, startReveal, startHide]
  );

  const pointLabelFn = useCallback((d: object) => {
    const p = d as PointDatum;
    const typeEntries = Object.entries(p.countsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const typesHtml = typeEntries
      .map(
        ([t, c]) =>
          `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:${getTypeColor(t)}">${t}</span><span>${c}</span></div>`
      )
      .join("");
    return `<div class="globe-tooltip">
      <div style="font-weight:600;margin-bottom:4px;color:#3790C9">${p.name}</div>
      <div style="opacity:0.55;margin-bottom:4px">${p.edgeCount} agreement connections</div>
      ${typesHtml}
    </div>`;
  }, []);

  // ── Arc callbacks (single layer) ─────────────────────────────────────

  const arcColorFn = useCallback(
    (d: object) => {
      const e = d as Edge;
      if (!highlightIso3) {
        const c = nightMode
          ? getTypeColorRgbaNight(e.agreement_type_code, 0.12)
          : getTypeColorRgba(e.agreement_type_code, 0.12);
        return [c, c];
      }
      const hl = nightMode ? NIGHT_ARC_HIGHLIGHT : ARC_HIGHLIGHT;
      return [hl, hl];
    },
    [highlightIso3, nightMode]
  );

  const arcStrokeFn = useCallback(
    () => {
      if (!highlightIso3) return 0.08;
      return 0.35;
    },
    [highlightIso3]
  );

  const arcDashLengthFn = useCallback(() => 1, []);
  const arcDashGapFn = useCallback(() => 0, []);
  const arcDashAnimFn = useCallback(() => 0, []);

  const arcLabelFn = useCallback((d: object) => {
    if (!selectedCountryIso3) return "";
    const e = d as Edge;
    return `<div class="globe-tooltip">
      <div style="font-weight:600;margin-bottom:4px;color:#3790C9">${e.short_title}</div>
      <div><span style="opacity:0.55">Type:</span> <span style="color:${getTypeColor(e.agreement_type_code)}">${e.agreement_type_code}</span></div>
      <div><span style="opacity:0.55">Date:</span> ${e.signature_date || "Unknown"}</div>
      <div><span style="opacity:0.55">Status:</span> ${e.status_text}</div>
      <div style="margin-top:4px;color:#827875">${e.src_name} → ${e.dst_name}</div>
    </div>`;
  }, [selectedCountryIso3]);

  // ── Reset ────────────────────────────────────────────────────────────

  const resetView = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }

    if (!selectedCountryIso3) {
      animPhaseRef.current = "idle";
      revealedIdsRef.current = new Set();
      const globe = globeRef.current;
      if (globe) globe.pointOfView({ lat: 20, lng: 0, altitude: isSmallScreen ? 3.5 : 2.5 }, 1000);
      return;
    }

    // If mid-centering or mid-reveal, cancel instantly
    if (animPhaseRef.current === "centering" || animPhaseRef.current === "revealing") {
      animPhaseRef.current = "idle";
      revealedIdsRef.current = new Set();
      sortedArcsRef.current = [];
      onSelectCountry(null);
      setArcTick(t => t + 1);
      const globe = globeRef.current;
      if (globe) globe.pointOfView({ lat: 20, lng: 0, altitude: isSmallScreen ? 3.5 : 2.5 }, 1000);
      return;
    }

    // In "selected" state: animate hide, then reset camera
    const pt = points.find(p => p.iso3 === selectedCountryIso3);
    if (!pt) {
      onSelectCountry(null);
      animPhaseRef.current = "idle";
      return;
    }

    const sorted = sortEdgesByBearing(pt.iso3, pt.lat, pt.lng, edges);
    sortedArcsRef.current = sorted;
    revealedIdsRef.current = new Set(sorted.map(e => e.edge_id));
    setArcTick(t => t + 1);

    startHide(() => {
      onSelectCountry(null);
      animPhaseRef.current = "resetting";
      setArcTick(t => t + 1);
      const globe = globeRef.current;
      if (globe) globe.pointOfView({ lat: 20, lng: 0, altitude: isSmallScreen ? 3.5 : 2.5 }, 1000);
      animTimerRef.current = setTimeout(() => {
        animPhaseRef.current = "idle";
        animTimerRef.current = null;
      }, 1000);
    });
  }, [selectedCountryIso3, onSelectCountry, edges, points, startHide]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ isolation: "isolate", transform: "translateZ(0)" }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl={`${import.meta.env.BASE_URL}textures/${nightMode ? "earth-night.jpg" : "earth-day.jpg"}`}
        backgroundImageUrl={nightMode ? `${import.meta.env.BASE_URL}textures/night-sky.png` : undefined}
        backgroundColor={nightMode ? NIGHT_BG : "#FAF9F6"}
        showAtmosphere={true}
        atmosphereColor={nightMode ? NIGHT_ATMOSPHERE : "rgba(55, 144, 201, 0.25)"}
        atmosphereAltitude={0.12}
        animateIn={true}
        // Native WebGL points
        pointsData={displayPoints}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColorFn}
        pointAltitude={0.005}
        pointRadius={0.35}
        pointResolution={isMobile ? 4 : 12}
        pointLabel={pointLabelFn}
        onPointClick={handlePointClick}
        pointsTransitionDuration={0}
        // Arcs
        arcsData={displayArcs}
        arcStartLat="src_lat"
        arcStartLng="src_lng"
        arcEndLat="dst_lat"
        arcEndLng="dst_lng"
        arcColor={arcColorFn}
        arcStroke={arcStrokeFn}
        arcDashLength={arcDashLengthFn}
        arcDashGap={arcDashGapFn}
        arcDashAnimateTime={arcDashAnimFn}
        arcAltitude={null}
        arcAltitudeAutoScale={0.4}
        arcLabel={arcLabelFn}
        arcCurveResolution={isMobile ? 6 : 16}
        arcsTransitionDuration={0}
        onArcHover={undefined}
      />

      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
        {isSmallScreen ? (
          <>
            <button
              onClick={onToggleNightMode}
              className={`pointer-events-auto absolute top-3 left-3 glass-panel flex items-center justify-center p-2.5 transition-colors cursor-pointer ${
                nightMode
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-[#3790C9] hover:text-[#41A0D8]"
              }`}
              title={nightMode ? "Switch to day mode" : "Switch to night mode"}
            >
              {nightMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={resetView}
              className="pointer-events-auto absolute top-3 right-3 glass-panel flex items-center justify-center p-2.5 text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer"
              title="Reset view"
            >
              <RotateCcw size={18} />
            </button>
          </>
        ) : (
          <div className="pointer-events-auto absolute flex items-center gap-2 bottom-6 right-6">
            <button
              onClick={onToggleNightMode}
              className={`glass-panel flex items-center gap-1.5 text-sm px-3 py-2 transition-colors cursor-pointer ${
                nightMode
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-[#3790C9] hover:text-[#41A0D8]"
              }`}
              title={nightMode ? "Switch to day mode" : "Switch to night mode"}
            >
              {nightMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={resetView}
              className="glass-panel flex items-center gap-2 text-sm text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer px-4 py-2"
              title="Reset view"
            >
              <RotateCcw size={16} />
              Reset View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const GlobeView = memo(GlobeViewInner);
export default GlobeView;
