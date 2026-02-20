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
  NIGHT_ARC_DIM,
  NIGHT_POINT_COLOR,
  NIGHT_POINT_COLOR_HIGHLIGHT,
} from "@/lib/colors";
import { isEdgeConnectedToCountry } from "@/lib/filtering";
import { RotateCcw, Sun, Moon } from "lucide-react";

interface GlobeViewProps {
  edges: Edge[];
  selectedCountryIso3: string | null;
  onSelectCountry: (iso3: string | null) => void;
  nightMode: boolean;
  onToggleNightMode: () => void;
}

const ARC_HIGHLIGHT = "rgba(55, 144, 201, 0.60)";
const ARC_DIM = "rgba(130, 120, 117, 0.03)";

const POINT_COLOR = "#3790C9";
const POINT_COLOR_HIGHLIGHT = "#41A0D8";

const SPREAD_THRESHOLD = 1.5;

const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

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

  const highlightIso3 = selectedCountryIso3;

  const points: PointDatum[] = useMemo(
    () => buildPointsFromEdges(edges),
    [edges]
  );

  const displayPoints = useMemo(
    () => spreadOverlappingPoints(points, zoomedIn),
    [points, zoomedIn]
  );

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
      controls.dampingFactor = 0.15;
      controls.rotateSpeed = 0.6;
      controls.zoomSpeed = 0.8;
      controls.minDistance = 120;
      controls.maxDistance = 600;
    }
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });

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
      if (nightMode) {
        if (highlightIso3 && p.iso3 === highlightIso3) return NIGHT_POINT_COLOR_HIGHLIGHT;
        return NIGHT_POINT_COLOR;
      }
      if (highlightIso3 && p.iso3 === highlightIso3) return POINT_COLOR_HIGHLIGHT;
      return POINT_COLOR;
    },
    [highlightIso3, nightMode]
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as PointDatum;
      if (selectedCountryIso3 === p.iso3) {
        onSelectCountry(null);
      } else {
        onSelectCountry(p.iso3);
        const globe = globeRef.current;
        if (globe) {
          globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 2 }, 1000);
        }
      }
    },
    [selectedCountryIso3, onSelectCountry]
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

  const ARC_TRANSPARENT = "rgba(0,0,0,0)";

  const arcColorFn = useCallback(
    (d: object) => {
      const e = d as Edge;
      if (!highlightIso3) {
        const c = nightMode
          ? getTypeColorRgbaNight(e.agreement_type_code, 0.12)
          : getTypeColorRgba(e.agreement_type_code, 0.12);
        return [c, c];
      }
      if (isEdgeConnectedToCountry(e, highlightIso3)) {
        const hl = nightMode ? NIGHT_ARC_HIGHLIGHT : ARC_HIGHLIGHT;
        return [hl, hl];
      }
      return [ARC_TRANSPARENT, ARC_TRANSPARENT];
    },
    [highlightIso3, nightMode]
  );

  const arcStrokeFn = useCallback(
    (d: object) => {
      if (!highlightIso3) return 0.08;
      if (isEdgeConnectedToCountry(d as Edge, highlightIso3)) return 0.35;
      return 0;
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
    onSelectCountry(null);
    const globe = globeRef.current;
    if (globe) {
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000);
    }
  }, [onSelectCountry]);

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
        pointResolution={isMobile ? 6 : 12}
        pointLabel={pointLabelFn}
        onPointClick={handlePointClick}
        pointsTransitionDuration={800}
        // Arcs
        arcsData={edges}
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
        arcCurveResolution={isMobile ? 8 : 16}
        onArcHover={undefined}
      />

      <div className="absolute bottom-6 right-6 flex items-center gap-2">
        <button
          onClick={onToggleNightMode}
          className={`glass-panel px-3 py-2 flex items-center gap-1.5 text-sm transition-colors cursor-pointer ${
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
          className="glass-panel px-4 py-2 flex items-center gap-2 text-sm text-[#3790C9] hover:text-[#41A0D8] transition-colors cursor-pointer"
          title="Reset view"
        >
          <RotateCcw size={16} />
          Reset View
        </button>
      </div>
    </div>
  );
}

const GlobeView = memo(GlobeViewInner);
export default GlobeView;
