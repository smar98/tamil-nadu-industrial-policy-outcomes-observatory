"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  ExternalLink,
  FileText,
  Scale,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type EvidenceClass =
  | "independent_direct"
  | "independent_partial"
  | "official_proxy"
  | "administrative_required"
  | "directional";

type TargetRecord = {
  id: string;
  statement: string;
  page: number;
  deadline: string | null;
  evidence_class: EvidenceClass;
  outcome_dataset: string;
  assessment: string;
  verdict?: string;
};

type Trajectory = {
  metric: string;
  pre_window: string;
  post_window: string;
  tn_pre_cagr: number;
  tn_post_cagr: number;
  peer_pre_median_cagr: number | null;
  peer_post_median_cagr: number | null;
  peer_states: number;
};

type Policy = {
  id: string;
  title: string;
  year: number;
  type: string;
  sector: string;
  issuer: string;
  status: string;
  source_url: string;
  source_tier: string;
  asi_sector_id: string | null;
  asi_sector_label: string | null;
  coverage_note: string;
  targets: TargetRecord[];
  trajectory: Trajectory | null;
  asi_summary: {
    latest_year: string;
    stability: string;
    sample_factories: number;
    post_policy_observations: number;
    latest: Record<string, number | null>;
    latest_three_year_average: Record<string, number | null>;
  } | null;
};

type AsiRecord = {
  year: number;
  year_label: string;
  state: string;
  state_name: string;
  sector_id: string;
  stability: string;
  sample_factories: number;
  [key: string]: string | number | null;
};

type ObservatoryData = {
  metadata: {
    updated: string;
    policy_count: number;
    target_count: number;
    evidence_counts: Record<EvidenceClass, number>;
    verdict_counts: Record<string, number>;
    asi_coverage: string;
    asi_source_url: string;
    asi_benchmark_passed: boolean;
    asi_benchmark_max_error: number;
    causal_note: string;
    price_note: string;
    peer_note: string;
    trajectory_note: string;
    disclosure_note: string;
  };
  evidence_classes: Record<EvidenceClass, string>;
  metrics: Record<string, { label: string; format: string; note: string }>;
  states: Record<string, string>;
  sectors: Array<{ id: string; label: string; limitation: string }>;
  policies: Policy[];
  asi_records: AsiRecord[];
  gsva: Array<{
    year: number;
    year_label: string;
    current_growth_pct: number | null;
    real_growth_pct: number | null;
    current_share_gsva_pct: number;
    constant_share_gsva_pct: number;
    estimate_status: string;
  }>;
  solar: {
    target_mw: number;
    actual_total_solar_mw: number;
    achievement_pct: number;
    shortfall_mw: number;
    source_url: string;
    method_note: string;
  };
  gsdp_archived: {
    source_url: string;
    archived_url: string;
    method_note: string;
    values: Array<{ year_label: string; manufacturing_share_pct: number }>;
  };
  benchmark_validation: {
    passed: boolean;
    tolerance: number;
    records: Array<{ year: number; metric: string; relative_error: number; pass: boolean }>;
  };
};

const EVIDENCE_META: Record<EvidenceClass, { short: string; label: string; className: string }> = {
  independent_direct: { short: "Direct", label: "Independently testable", className: "evidence-direct" },
  independent_partial: { short: "Partial", label: "Independent partial measure", className: "evidence-partial" },
  official_proxy: { short: "Proxy", label: "Official proxy only", className: "evidence-proxy" },
  administrative_required: { short: "Admin", label: "Administrative records required", className: "evidence-admin" },
  directional: { short: "Directional", label: "No numeric test", className: "evidence-directional" },
};

const STATE_COLORS: Record<string, string> = {
  "33": "#048768",
  "24": "#C4622D",
  "29": "#3D7BB8",
  "09": "#9C6F00",
  "06": "#5E8F35",
  "28+36": "#B4527A",
  "27": "#7A5FB5",
};

const VERDICT_META: Record<string, { label: string; tone: "missed" | "pending" }> = {
  not_met: { label: "Not met", tone: "missed" },
  below_target: { label: "Below target", tone: "missed" },
  below_target_so_far: { label: "Below target so far", tone: "missed" },
  not_due: { label: "Not yet due", tone: "pending" },
};

const FACTORY_METRICS = [
  "employees",
  "gva_output_ratio",
  "female_direct_worker_share",
  "contract_worker_share",
  "rd_gva_share",
  "training_factory_share",
];

function compactIN(value: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function fullIN(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatMetric(value: number | null | undefined, format = "count") {
  if (value == null || !Number.isFinite(value)) return "Not available";
  if (format === "percent") return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
  return compactIN(value);
}

function pctPoint(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function statusLabel(status: string) {
  return status.replaceAll("-", " ").replaceAll("_", " ");
}

function evidenceForPolicy(policy: Policy): EvidenceClass {
  if (!policy.targets.length) return "directional";
  const order: EvidenceClass[] = [
    "independent_direct",
    "independent_partial",
    "official_proxy",
    "administrative_required",
  ];
  return order.find((key) => policy.targets.some((target) => target.evidence_class === key)) ?? "directional";
}

function evidenceSource(target: TargetRecord, data: ObservatoryData) {
  const dataset = target.outcome_dataset.toLowerCase();
  if (dataset.includes("archived 2004-05")) {
    return { label: "MoSPI archived 2004-05-base GSDP tables", url: data.gsdp_archived.source_url };
  }
  if (dataset.includes("tamil nadu des")) {
    return { label: "Tamil Nadu DES state-income tables", url: "https://des.tn.gov.in/node/346" };
  }
  if (dataset.includes("mnre")) {
    return { label: "MNRE state renewable-capacity statement", url: data.solar.source_url };
  }
  if (dataset.includes("asi")) {
    return { label: "MoSPI Annual Survey of Industries", url: data.metadata.asi_source_url };
  }
  if (dataset.includes("dgc")) {
    return { label: "DGCIS TradeStat customs-origin exports", url: "https://tradestat.commerce.gov.in/eidb/" };
  }
  if (dataset.includes("plfs") || dataset.includes("labour-force")) {
    return { label: "MoSPI Periodic Labour Force Survey", url: "https://www.mospi.gov.in/PLFS" };
  }
  return { label: target.outcome_dataset, url: null };
}

function evidenceState(target: TargetRecord) {
  if (target.verdict) return "Scored from published outcome data";
  if (target.evidence_class === "independent_direct") return "Comparable public series found; score incomplete";
  if (target.evidence_class === "independent_partial") return "Contextual trend only; no target verdict";
  if (target.evidence_class === "official_proxy") return "Proxy identified; no target verdict";
  return "Not publicly verifiable";
}

function comparisonRule(target: TargetRecord) {
  if (target.evidence_class === "independent_direct") {
    return "The indicator, geography, denominator and deadline must match the promise. Only then is the observed value compared with the stated threshold.";
  }
  if (target.evidence_class === "independent_partial") {
    return "The public series is used only to show direction or a defensible lower bound. It is not treated as the policy's full outcome universe.";
  }
  if (target.evidence_class === "official_proxy") {
    return "The official series measures a neighbouring concept. It can be monitored, but it cannot support a pass/fail score for this promise.";
  }
  return "A score is withheld until the named administrative records are published, deduplicated and reconciled to the policy's definition.";
}

function Stamp({ verdict, size = "regular" }: { verdict: string; size?: "regular" | "small" }) {
  const meta = VERDICT_META[verdict];
  if (!meta) return null;
  return <span className={`stamp stamp-${meta.tone} stamp-${size}`}>{meta.label}</span>;
}

function MiniBadge({ evidence }: { evidence: EvidenceClass }) {
  const meta = EVIDENCE_META[evidence];
  return <span className={`mini-badge ${meta.className}`}>{meta.short}</span>;
}

function ReadingNote({ children }: { children: ReactNode }) {
  return (
    <p className="reading-note">
      <CircleHelp size={15} aria-hidden />
      <span>
        <strong>How to read it</strong>
        {children}
      </span>
    </p>
  );
}

function LoadingView() {
  return (
    <main className="loading-view">
      <div className="loading-mark">TN</div>
      <p>Loading the policy evidence ledger…</p>
    </main>
  );
}

type Point = { year: number; label: string; value: number | null };

function LineChart({
  series,
  format = "number",
  targetLines = [],
  policyYears = [],
  peerRange,
  description,
}: {
  series: Array<{ id: string; label: string; color: string; points: Point[] }>;
  format?: "number" | "percent" | "percentagePoint";
  targetLines?: Array<{ value: number; label: string; color: string }>;
  policyYears?: Array<{ year: number; label: string }>;
  peerRange?: Array<{ year: number; low: number; high: number }>;
  description: string;
}) {
  const [hovered, setHovered] = useState<{ x: number; point: Point; series: string } | null>(null);
  const width = 860;
  const height = 310;
  const pad = { left: 58, right: 24, top: 24, bottom: 42 };
  const allPoints = series.flatMap((item) => item.points).filter((point) => point.value != null);
  if (allPoints.length === 0) {
    return (
      <div className="chart-empty" role="status">
        <strong>No publishable series</strong>
        <span>
          ASI cells are withheld when the public microdata do not support a disclosure-safe estimate. This is an
          evidence gap, not a zero.
        </span>
      </div>
    );
  }
  const years = allPoints.map((point) => point.year);
  const values = [
    ...allPoints.map((point) => point.value as number),
    ...targetLines.map((target) => target.value),
    ...(peerRange?.flatMap((point) => [point.low, point.high]) ?? []),
  ];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  // Clamp the floor to zero only when nothing is negative; otherwise keep the
  // true extent and draw an explicit zero line.
  const hasNegative = minValue < 0;
  minValue = hasNegative ? minValue - range * 0.08 : Math.max(0, minValue - range * 0.12);
  maxValue += range * 0.14;
  const x = (year: number) =>
    pad.left + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((maxValue - value) / (maxValue - minValue)) * (height - pad.top - pad.bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => minValue + ((maxValue - minValue) * index) / 4).reverse();

  const display = (value: number) => {
    if (format === "percent") return `${(value * 100).toFixed(1)}%`;
    if (format === "percentagePoint") return `${value.toFixed(1)}%`;
    return compactIN(value);
  };
  const displayFull = (value: number) => {
    if (format === "percent") return `${(value * 100).toFixed(2)}%`;
    if (format === "percentagePoint") return `${value.toFixed(2)}%`;
    return fullIN(value);
  };

  const pathFor = (points: Point[]) => {
    let started = false;
    return points
      .map((point) => {
        if (point.value == null) {
          started = false;
          return "";
        }
        const command = started ? "L" : "M";
        started = true;
        return `${command}${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`;
      })
      .join(" ");
  };

  const rangePath = peerRange?.length
    ? `${peerRange.map((point, index) => `${index ? "L" : "M"}${x(point.year)},${y(point.high)}`).join(" ")} ${[...peerRange]
        .reverse()
        .map((point) => `L${x(point.year)},${y(point.low)}`)
        .join(" ")} Z`
    : null;

  // Nudge target-line labels apart when thresholds sit close together.
  const targetLabels = targetLines
    .map((target) => ({ ...target, y: y(target.value) - 6 }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < targetLabels.length; i += 1) {
    if (targetLabels[i].y - targetLabels[i - 1].y < 14) {
      targetLabels[i].y = targetLabels[i - 1].y + 14;
    }
  }

  return (
    <div className="chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="axis-label">
              {display(tick)}
            </text>
          </g>
        ))}
        {hasNegative && (
          <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="zero-line" />
        )}
        {[minYear, Math.round((minYear + maxYear) / 2), maxYear].map((year) => (
          <text key={year} x={x(year)} y={height - 14} textAnchor="middle" className="axis-label">
            {year}-{String(year + 1).slice(-2)}
          </text>
        ))}
        {rangePath && <path d={rangePath} className="peer-range" />}
        {policyYears.map((marker) => (
          <g key={`${marker.year}-${marker.label}`}>
            <line
              x1={x(marker.year)}
              x2={x(marker.year)}
              y1={pad.top}
              y2={height - pad.bottom}
              className="policy-marker"
            />
            <text x={x(marker.year) + 5} y={pad.top + 10} className="policy-marker-label">
              {marker.label}
            </text>
          </g>
        ))}
        {targetLines.map((target) => (
          <line
            key={target.label}
            x1={pad.left}
            x2={width - pad.right}
            y1={y(target.value)}
            y2={y(target.value)}
            stroke={target.color}
            className="target-line"
          />
        ))}
        {targetLabels.map((target) => (
          <text
            key={target.label}
            x={width - pad.right}
            y={target.y}
            textAnchor="end"
            fill={target.color}
            className="target-label"
          >
            {target.label}
          </text>
        ))}
        {series.map((item) => (
          <g key={item.id}>
            <path d={pathFor(item.points)} fill="none" stroke={item.color} className="series-line" />
            {item.points
              .filter((point) => point.value != null)
              .map((point) => (
                <circle
                  key={`${item.id}-${point.year}`}
                  cx={x(point.year)}
                  cy={y(point.value as number)}
                  r="9"
                  className="hover-point"
                  tabIndex={0}
                  aria-label={`${item.label}, ${point.label}: ${displayFull(point.value as number)}`}
                  onMouseEnter={() => setHovered({ x: x(point.year), point, series: item.label })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ x: x(point.year), point, series: item.label })}
                  onBlur={() => setHovered(null)}
                  onClick={() => setHovered({ x: x(point.year), point, series: item.label })}
                />
              ))}
          </g>
        ))}
        {hovered && hovered.point.value != null && (
          <g
            className="chart-tooltip"
            transform={`translate(${Math.min(hovered.x + 10, width - 190)},${Math.max(
              y(hovered.point.value) - 56,
              8,
            )})`}
          >
            <rect width="176" height="48" rx="4" />
            <text x="10" y="18">
              {hovered.series} · {hovered.point.label}
            </text>
            <text x="10" y="37" className="tooltip-value">
              {displayFull(hovered.point.value)}
            </text>
          </g>
        )}
      </svg>
      <div className="series-legend">
        {series.map((item) => (
          <span key={item.id}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        {peerRange && (
          <span>
            <i className="range-key" />
            Peer range
          </span>
        )}
      </div>
    </div>
  );
}

function SolarMeter({ data }: { data: ObservatoryData }) {
  const share = Math.min(100, data.solar.achievement_pct);
  return (
    <div className="solar-meter">
      <div className="solar-meter-figures">
        <strong>{data.solar.achievement_pct.toFixed(1)}%</strong>
        <span>of the 9,000 MW target installed by the 2023 deadline</span>
      </div>
      <div
        className="meter-track"
        role="img"
        aria-label={`Installed ${fullIN(data.solar.actual_total_solar_mw)} megawatts of a ${fullIN(
          data.solar.target_mw,
        )} megawatt target: ${data.solar.achievement_pct.toFixed(1)} percent`}
      >
        <div className="meter-fill" style={{ width: `${share}%` }} />
        <div className="meter-target" style={{ left: "100%" }} />
      </div>
      <div className="solar-numbers">
        <div>
          <span>Installed, 31 Mar 2023</span>
          <strong>{fullIN(data.solar.actual_total_solar_mw)} MW</strong>
        </div>
        <div>
          <span>Target</span>
          <strong>{fullIN(data.solar.target_mw)} MW</strong>
        </div>
        <div>
          <span>Shortfall</span>
          <strong>{fullIN(data.solar.shortfall_mw)} MW</strong>
        </div>
      </div>
      <a href={data.solar.source_url} target="_blank" rel="noreferrer">
        MNRE source <ExternalLink size={13} />
      </a>
    </div>
  );
}

function Dumbbell({
  pre,
  post,
  min,
  max,
  color,
  label,
}: {
  pre: number;
  post: number;
  min: number;
  max: number;
  color: string;
  label: string;
}) {
  const scale = (value: number) => ((value - min) / (max - min)) * 100;
  const left = Math.min(scale(pre), scale(post));
  const width = Math.abs(scale(post) - scale(pre));
  return (
    <div className="dumbbell-row">
      <span className="dumbbell-label">{label}</span>
      <div
        className="dumbbell-track"
        role="img"
        aria-label={`${label}: ${pctPoint(pre)} a year before, ${pctPoint(post)} a year after`}
      >
        {min < 0 && <span className="dumbbell-zero" style={{ left: `${scale(0)}%` }} />}
        <span className="dumbbell-bar" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
        <span className="dumbbell-dot dumbbell-pre" style={{ left: `${scale(pre)}%`, borderColor: color }} />
        <span className="dumbbell-dot dumbbell-post" style={{ left: `${scale(post)}%`, background: color }} />
      </div>
      <span className="dumbbell-values">
        {pctPoint(pre)} <ArrowRight size={11} aria-hidden /> <strong>{pctPoint(post)}</strong>
      </span>
    </div>
  );
}

function TrajectoryPanel({ policy }: { policy: Policy }) {
  const trajectory = policy.trajectory;
  if (!trajectory) return null;
  // A "median" of one or two states is noise, not a benchmark.
  const showPeers =
    trajectory.peer_states >= 3 &&
    trajectory.peer_pre_median_cagr != null &&
    trajectory.peer_post_median_cagr != null;
  const values = [
    trajectory.tn_pre_cagr,
    trajectory.tn_post_cagr,
    ...(showPeers ? [trajectory.peer_pre_median_cagr!, trajectory.peer_post_median_cagr!] : []),
    0,
  ];
  const min = Math.min(...values) - 0.01;
  const max = Math.max(...values) + 0.01;
  return (
    <div className="trajectory-panel">
      <Dumbbell
        pre={trajectory.tn_pre_cagr}
        post={trajectory.tn_post_cagr}
        min={min}
        max={max}
        color="#048768"
        label="Tamil Nadu"
      />
      {showPeers ? (
        <Dumbbell
          pre={trajectory.peer_pre_median_cagr!}
          post={trajectory.peer_post_median_cagr!}
          min={min}
          max={max}
          color="#8B8878"
          label={`Peer median (${trajectory.peer_states})`}
        />
      ) : (
        <p className="trajectory-windows">Too few peer states publish this sector for a defensible comparison.</p>
      )}
      <p className="trajectory-windows">
        Factory employment, growth per year: {trajectory.pre_window} (before) → {trajectory.post_window} (after).
        Hollow dot = before, filled dot = after.
      </p>
    </div>
  );
}

function PolicyDrawer({ policy, data, onClose }: { policy: Policy | null; data: ObservatoryData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!policy) return null;
  return (
    <div className="drawer-shell" role="dialog" aria-modal="true" aria-label={policy.title}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close policy details" />
      <aside className="policy-drawer">
        <header>
          <div>
            <span className="eyebrow">
              {policy.year} · {policy.sector}
            </span>
            <h2>{policy.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-status-row">
            <span>{statusLabel(policy.status)}</span>
            <span>
              {policy.targets.length} headline {policy.targets.length === 1 ? "commitment" : "commitments"}
            </span>
          </div>
          <p className="coverage-note">{policy.coverage_note}</p>

          {policy.targets.length ? (
            <section className="target-list">
              <h3>Outcome commitments</h3>
              {policy.targets.map((target) => (
                <article key={target.id}>
                  <div className="target-heading">
                    <MiniBadge evidence={target.evidence_class} />
                    {target.verdict && <Stamp verdict={target.verdict} size="small" />}
                  </div>
                  <div className={`verification-status ${target.verdict ? "is-scored" : ""}`}>
                    {target.verdict ? <Check size={15} aria-hidden /> : <Scale size={15} aria-hidden />}
                    <span>{evidenceState(target)}</span>
                  </div>
                  <div className="verification-chain">
                    <div className="verification-step">
                      <span>1</span>
                      <div>
                        <small>Promise</small>
                        <h4 className="promise-quote">{target.statement}</h4>
                        <a href={`${policy.source_url}#page=${target.page}`} target="_blank" rel="noreferrer">
                          Policy PDF, page {target.page} <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                    <div className="verification-step">
                      <span>2</span>
                      <div>
                        <small>Outcome evidence</small>
                        <p>{target.outcome_dataset}</p>
                        {evidenceSource(target, data).url ? (
                          <a href={evidenceSource(target, data).url!} target="_blank" rel="noreferrer">
                            {evidenceSource(target, data).label} <ExternalLink size={12} />
                          </a>
                        ) : (
                          <em>Required record is not published as a usable public series.</em>
                        )}
                      </div>
                    </div>
                    <div className="verification-step">
                      <span>3</span>
                      <div>
                        <small>Decision rule</small>
                        <p>{comparisonRule(target)}</p>
                      </div>
                    </div>
                    <div className="verification-step verification-result">
                      <span>4</span>
                      <div>
                        <small>{target.verdict ? "Result" : "Why no verdict"}</small>
                        <p>{target.assessment}</p>
                        {target.verdict && <Stamp verdict={target.verdict} />}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="no-target-state">
              <CircleHelp size={22} aria-hidden />
              <div>
                <strong>No headline numeric outcome</strong>
                <p>Eligibility thresholds and subsidy amounts are not counted as policy targets.</p>
              </div>
            </div>
          )}

          {policy.trajectory && (
            <section className="asi-snapshot">
              <div className="snapshot-heading">
                <div>
                  <h3>Did the employment trend change?</h3>
                  <span>Registered factories · associational, not causal</span>
                </div>
                <MiniBadge evidence="independent_partial" />
              </div>
              <TrajectoryPanel policy={policy} />
            </section>
          )}

          {policy.asi_summary && (
            <section className="asi-snapshot">
              <div className="snapshot-heading">
                <div>
                  <h3>Registered-factory context</h3>
                  <span>Not automatically used to score the commitments above</span>
                </div>
                <MiniBadge evidence="independent_partial" />
              </div>
              <div className="snapshot-grid">
                <div>
                  <span>People engaged</span>
                  <strong>{formatMetric(policy.asi_summary.latest.employees)}</strong>
                </div>
                <div>
                  <span>Value-added share</span>
                  <strong>{formatMetric(policy.asi_summary.latest.gva_output_ratio, "percent")}</strong>
                </div>
                <div>
                  <span>Women, direct workers</span>
                  <strong>{formatMetric(policy.asi_summary.latest.female_direct_worker_share, "percent")}</strong>
                </div>
                <div>
                  <span>Latest year</span>
                  <strong>{policy.asi_summary.latest_year}</strong>
                </div>
              </div>
              <p>
                {policy.asi_sector_label}. Cell stability: {policy.asi_summary.stability};{" "}
                {fullIN(policy.asi_summary.sample_factories)} sampled factories. {policy.coverage_note}
              </p>
              <a href={data.metadata.asi_source_url} target="_blank" rel="noreferrer">
                Open ASI source catalogue <ExternalLink size={12} />
              </a>
            </section>
          )}
        </div>
        <footer>
          <a href={policy.source_url} target="_blank" rel="noreferrer">
            Open policy PDF <ExternalLink size={15} />
          </a>
          <span>
            {["official", "official-state-agency"].includes(policy.source_tier)
              ? "Government-hosted source"
              : "Official policy · external document archive"}
          </span>
        </footer>
      </aside>
    </div>
  );
}

function App({ data }: { data: ObservatoryData }) {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [search, setSearch] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | EvidenceClass>("all");
  const [sectorId, setSectorId] = useState("all-manufacturing");
  const [metricId, setMetricId] = useState("employees");
  const [peerState, setPeerState] = useState("24");

  const policyById = useMemo(() => new Map(data.policies.map((policy) => [policy.id, policy])), [data.policies]);
  const targetById = useMemo(() => {
    const map = new Map<string, { target: TargetRecord; policy: Policy }>();
    data.policies.forEach((policy) => policy.targets.forEach((target) => map.set(target.id, { target, policy })));
    return map;
  }, [data.policies]);

  const filteredPolicies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.policies.filter((policy) => {
      const matchesSearch = !query || `${policy.title} ${policy.sector} ${policy.year}`.toLowerCase().includes(query);
      const matchesEvidence = evidenceFilter === "all" || evidenceForPolicy(policy) === evidenceFilter;
      return matchesSearch && matchesEvidence;
    });
  }, [data.policies, evidenceFilter, search]);

  const gsvaSeries = [
    {
      id: "real",
      label: "Real growth",
      color: "#048768",
      points: data.gsva.map((row) => ({ year: row.year, label: row.year_label, value: row.real_growth_pct })),
    },
    {
      id: "nominal",
      label: "Nominal growth",
      color: "#C4622D",
      points: data.gsva.map((row) => ({ year: row.year, label: row.year_label, value: row.current_growth_pct })),
    },
  ];

  const selectedRecords = data.asi_records.filter((record) => record.sector_id === sectorId);
  const chartSeries = ["33", peerState].map((state) => ({
    id: state,
    label: data.states[state],
    color: STATE_COLORS[state] ?? "#8B8878",
    points: selectedRecords
      .filter((record) => record.state === state)
      .sort((a, b) => a.year - b.year)
      .map((record) => ({
        year: record.year,
        label: record.year_label,
        value: typeof record[metricId] === "number" ? (record[metricId] as number) : null,
      })),
  }));

  const peerRange = useMemo(() => {
    const peers = Object.keys(data.states).filter((state) => state !== "33");
    return Array.from(new Set(selectedRecords.map((record) => record.year)))
      .sort()
      .map((year) => {
        const values = selectedRecords
          .filter((record) => record.year === year && peers.includes(record.state) && typeof record[metricId] === "number")
          .map((record) => record[metricId] as number);
        return values.length ? { year, low: Math.min(...values), high: Math.max(...values) } : null;
      })
      .filter((row): row is { year: number; low: number; high: number } => row != null);
  }, [data.states, metricId, selectedRecords]);

  const selectedSector = data.sectors.find((sector) => sector.id === sectorId)!;
  const selectedMetric = data.metrics[metricId];
  const directTargetCount = data.metadata.evidence_counts.independent_direct ?? 0;
  const verdictCounts = data.metadata.verdict_counts;
  const scoredCount =
    (verdictCounts.not_met ?? 0) + (verdictCounts.below_target ?? 0) + (verdictCounts.below_target_so_far ?? 0);

  const gsdpLatest = data.gsdp_archived.values[data.gsdp_archived.values.length - 1];
  const latestGsva = data.gsva[data.gsva.length - 1];

  const findings: Array<{
    id: string;
    targetId: string;
    headline: string;
    detail: string;
    figure: string;
    figureLabel: string;
  }> = [
    {
      id: "finding-2007",
      targetId: "industrial-2007-share",
      headline: "Manufacturing's share of the economy fell while the 2007 policy promised a rise to 27%.",
      detail: `On the archived GSDP series contemporaneous with the target, the share moved from 20.8% in 2006-07 to ${gsdpLatest.manufacturing_share_pct.toFixed(1)}% by ${gsdpLatest.year_label}. Every available series shows movement away from the target.`,
      figure: `${gsdpLatest.manufacturing_share_pct.toFixed(1)}%`,
      figureLabel: `share in ${gsdpLatest.year_label} vs 27% promised`,
    },
    {
      id: "finding-2014",
      targetId: "industrial-2014-growth",
      headline: "Manufacturing growth stayed below the 2014 policy's 14% annual goal.",
      detail:
        "From 2014-15 to 2020-21, GSVA grew 9.7% a year in nominal terms and 8.5% in real terms. Excluding the COVID year gives 11.8% and 10.6% — still below target.",
      figure: "8.5%",
      figureLabel: "real growth per year vs 14% promised",
    },
    {
      id: "finding-2021",
      targetId: "industrial-2021-growth",
      headline: "Growth is also running below the 2021 policy's 15% annual goal so far.",
      detail:
        "From 2020-21 to 2023-24, GSVA grew 13.3% a year nominal and 8.3% real. The COVID-depressed base flatters these rates; from 2021-22 they are 10.2% and 7.8%.",
      figure: "8.3%",
      figureLabel: "real growth per year vs 15% promised",
    },
    {
      id: "finding-solar",
      targetId: "solar-2019-capacity",
      headline: "Tamil Nadu reached three-quarters of its 2023 solar-capacity target.",
      detail: `MNRE recorded ${fullIN(data.solar.actual_total_solar_mw)} MW installed against the 9,000 MW target — a shortfall of ${fullIN(data.solar.shortfall_mw)} MW. The consumer-category sub-target is not scored because definitions do not align.`,
      figure: `${data.solar.achievement_pct.toFixed(1)}%`,
      figureLabel: "of target installed by deadline",
    },
  ];

  const trajectoryPolicies = data.policies
    .filter((policy) => policy.trajectory)
    .sort((a, b) => a.year - b.year);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">
          <span>TN</span>
          <strong>Policy Outcomes Observatory</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#findings">Verdicts</a>
          <a href="#how-to-read">How to read</a>
          <a href="#policies">Ledger</a>
          <a href="#factories">Factory record</a>
          <a href="#method">Method</a>
        </nav>
        <a className="icon-button" href="/data/observatory.json" title="Download the public dataset" download>
          <ArrowDownToLine size={18} />
        </a>
      </header>

      <main id="top">
        <section className="overview-band">
          <div className="overview-copy">
            <span className="eyebrow">
              <ShieldCheck size={15} aria-hidden /> An independent public audit · 2007–2026
            </span>
            <h1>
              What Tamil Nadu&rsquo;s industrial policies promised, and what the evidence can show.
            </h1>
            <p>
              {data.metadata.policy_count} policies made {data.metadata.target_count} headline numeric commitments.
              This ledger traces each one from the policy PDF to official outcome data — and issues a verdict only
              where the evidence honestly supports one.
            </p>
            <div className="verdict-board" role="list" aria-label="Scored verdicts">
              {findings.map((finding) => {
                const entry = targetById.get(finding.targetId);
                if (!entry) return null;
                return (
                  <a key={finding.id} href={`#${finding.id}`} role="listitem" className="verdict-chip">
                    <Stamp verdict={entry.target.verdict ?? "not_met"} size="small" />
                    <span>
                      {entry.policy.year} · {entry.policy.sector}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
          <div className="overview-evidence">
            <div className="panel-heading">
              <div>
                <h2>How much can be independently tested?</h2>
              </div>
            </div>
            <div className="evidence-stack" aria-label="Commitments by evidence route">
              <div className="evidence-stack-bar">
                {(
                  ["independent_direct", "independent_partial", "official_proxy", "administrative_required"] as EvidenceClass[]
                ).map((key) => {
                  const count = data.metadata.evidence_counts[key] ?? 0;
                  return (
                    <span
                      className={EVIDENCE_META[key].className}
                      key={key}
                      style={{ width: `${(count / data.metadata.target_count) * 100}%` }}
                      title={`${EVIDENCE_META[key].label}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="evidence-legend">
                {(
                  ["independent_direct", "independent_partial", "official_proxy", "administrative_required"] as EvidenceClass[]
                ).map((key) => (
                  <div key={key}>
                    <i className={EVIDENCE_META[key].className} />
                    <span>{EVIDENCE_META[key].label}</span>
                    <strong>{data.metadata.evidence_counts[key] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </div>
            <p>
              Only {directTargetCount} of {data.metadata.target_count} commitments have a directly comparable
              independent series. {scoredCount} verdicts are scored so far; {verdictCounts.not_due ?? 0} targets are
              not yet due. That scarcity is a finding, not a missing-data footnote.
            </p>
          </div>
        </section>

        <section id="how-to-read" className="reading-map">
          <div className="reading-map-heading">
            <span className="eyebrow">The logic of the observatory</span>
            <h2>One policy promise. Four checks.</h2>
            <p>A verdict is the end of the chain, not the starting point.</p>
          </div>
          <div className="reading-steps">
            <div>
              <span>1</span>
              <strong>Read the promise</strong>
              <p>What exactly did the policy commit to, for whom, and by when?</p>
            </div>
            <ArrowRight size={18} aria-hidden />
            <div>
              <span>2</span>
              <strong>Find the outcome</strong>
              <p>Is there a published series measuring the same thing in Tamil Nadu?</p>
            </div>
            <ArrowRight size={18} aria-hidden />
            <div>
              <span>3</span>
              <strong>Test the match</strong>
              <p>Do geography, denominator, deadline and price basis line up?</p>
            </div>
            <ArrowRight size={18} aria-hidden />
            <div>
              <span>4</span>
              <strong>Issue or withhold a verdict</strong>
              <p>If any essential link fails, the honest result is &ldquo;not verifiable.&rdquo;</p>
            </div>
          </div>
        </section>

        <section id="findings" className="section-band findings-band">
          <div className="section-header">
            <div>
              <span className="eyebrow">Scored verdicts</span>
              <h2>Four claims the data can support</h2>
            </div>
            <ReadingNote>
              These are target checks, not claims that the policy caused the outcome. Each is robust to the obvious
              objection — COVID endpoints, base years, price basis.
            </ReadingNote>
          </div>
          <div className="finding-list">
            {findings.map((finding) => {
              const entry = targetById.get(finding.targetId);
              return (
                <article key={finding.id} id={finding.id}>
                  <div className="finding-top">
                    {entry?.target.verdict && <Stamp verdict={entry.target.verdict} size="small" />}
                    <button
                      className="finding-open"
                      onClick={() => entry && setSelectedPolicy(entry.policy)}
                      aria-label={`Open the full verification chain for ${entry?.policy.title ?? "this policy"}`}
                    >
                      Full chain <ChevronRight size={13} aria-hidden />
                    </button>
                  </div>
                  <div>
                    <h3>{finding.headline}</h3>
                    <p>{finding.detail}</p>
                  </div>
                  <strong>
                    {finding.figure}
                    <small>{finding.figureLabel}</small>
                  </strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section-band evidence-detail-band">
          <div className="chart-panel growth-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Manufacturing GSVA</span>
                <h2>Growth against the policy thresholds</h2>
              </div>
            </div>
            <LineChart
              series={gsvaSeries}
              format="percentagePoint"
              targetLines={[
                { value: 14, label: "2014 policy: 14%", color: "#9C6F00" },
                { value: 15, label: "2021 policy: 15%", color: "#7A5FB5" },
              ]}
              policyYears={[
                { year: 2014, label: "2014 policy" },
                { year: 2021, label: "2021 policy" },
              ]}
              description="Annual manufacturing growth in Tamil Nadu, real and nominal, 2012-13 to 2023-24, against the 14 and 15 percent policy thresholds"
            />
            <ReadingNote>
              Each point is one year&rsquo;s manufacturing growth. Dashed lines are policy thresholds. Below a line
              means observed growth was lower, not that the policy caused the difference.
            </ReadingNote>
            <details className="data-table-details">
              <summary>View the data table</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Real growth</th>
                    <th scope="col">Nominal growth</th>
                    <th scope="col">Estimate status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gsva
                    .filter((row) => row.real_growth_pct != null)
                    .map((row) => (
                      <tr key={row.year_label}>
                        <th scope="row">{row.year_label}</th>
                        <td>{row.real_growth_pct?.toFixed(2)}%</td>
                        <td>{row.current_growth_pct?.toFixed(2)}%</td>
                        <td>{row.estimate_status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
            <div className="source-line">
              <Database size={14} aria-hidden /> Tamil Nadu Department of Economics and Statistics · 2011-12 base ·
              latest years are revised/quick/advance estimates
            </div>
          </div>
          <div className="solar-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Solar Policy 2019</span>
                <h2>Installed capacity by the deadline</h2>
              </div>
            </div>
            <SolarMeter data={data} />
            <ReadingNote>
              Installed capacity divided by the 9,000 MW deadline target. This is a direct target comparison from MNRE
              records.
            </ReadingNote>
          </div>
        </section>

        <section id="trajectories" className="section-band trajectory-band">
          <div className="section-header">
            <div>
              <span className="eyebrow">Before and after</span>
              <h2>Did the employment trend change?</h2>
            </div>
            <ReadingNote>{data.metadata.trajectory_note}</ReadingNote>
          </div>
          <div className="trajectory-grid">
            {trajectoryPolicies.map((policy) => (
              <button key={policy.id} className="trajectory-card" onClick={() => setSelectedPolicy(policy)}>
                <span className="trajectory-title">{policy.title}</span>
                <TrajectoryPanel policy={policy} />
              </button>
            ))}
          </div>
          <p className="trajectory-footnote">
            Growth per year in registered-factory employment (weighted ASI estimates). Peer median covers the six
            comparison states. Sectors overlap across policies where they share an ASI definition.
          </p>
        </section>

        <section id="policies" className="section-band policies-band">
          <div className="section-header">
            <div>
              <span className="eyebrow">The evidence ledger</span>
              <h2>Every policy, promise by promise</h2>
            </div>
            <ReadingNote>
              Open any row to see the claim-to-source verification chain for each commitment: the promise, the outcome
              series, the decision rule, and the result — or the specific record that would be required.
            </ReadingNote>
          </div>
          <div className="ledger-heading">
            <div>
              <h3>Policy evidence ledger</h3>
              <span>
                {filteredPolicies.length} of {data.policies.length}
              </span>
            </div>
            <div className="ledger-controls">
              <label className="search-control">
                <Search size={16} aria-hidden />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search policy or sector"
                  aria-label="Search policy or sector"
                />
              </label>
              <select
                value={evidenceFilter}
                onChange={(event) => setEvidenceFilter(event.target.value as "all" | EvidenceClass)}
                aria-label="Filter by evidence class"
              >
                <option value="all">All evidence routes</option>
                {(Object.keys(EVIDENCE_META) as EvidenceClass[]).map((key) => (
                  <option value={key} key={key}>
                    {EVIDENCE_META[key].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="policy-table">
            <div className="policy-table-head" aria-hidden>
              <span>Year</span>
              <span>Policy</span>
              <span>Evidence route</span>
              <span>Verdicts</span>
              <span />
            </div>
            {filteredPolicies.map((policy) => {
              const evidence = evidenceForPolicy(policy);
              const verdicts = policy.targets.filter((target) => target.verdict);
              return (
                <button className="policy-row" key={policy.id} onClick={() => setSelectedPolicy(policy)}>
                  <span className="policy-row-year">{policy.year}</span>
                  <span className="policy-row-title">
                    <strong>{policy.title}</strong>
                    <small>{policy.sector}</small>
                  </span>
                  <span className="policy-row-evidence">
                    <MiniBadge evidence={evidence} />
                    {EVIDENCE_META[evidence].label}
                  </span>
                  <span className="policy-row-verdicts">
                    {verdicts.length ? (
                      verdicts.map((target) => <Stamp key={target.id} verdict={target.verdict!} size="small" />)
                    ) : policy.targets.length ? (
                      <small>{policy.targets.length} unscored</small>
                    ) : (
                      <small>—</small>
                    )}
                  </span>
                  <ChevronRight size={17} aria-hidden />
                </button>
              );
            })}
          </div>
        </section>

        <section id="factories" className="section-band factories-band">
          <div className="section-header">
            <div>
              <span className="eyebrow">Factory record</span>
              <h2>What changed inside registered manufacturing?</h2>
            </div>
            <ReadingNote>
              Use this to inspect direction and scale among registered factories. Peer states provide context, not a
              counterfactual. {data.metadata.peer_note}
            </ReadingNote>
          </div>
          <div className="factory-controls">
            <label>
              <span>Sector</span>
              <select value={sectorId} onChange={(event) => setSectorId(event.target.value)}>
                {data.sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Comparison state</span>
              <select value={peerState} onChange={(event) => setPeerState(event.target.value)}>
                {Object.entries(data.states)
                  .filter(([code]) => code !== "33")
                  .map(([code, name]) => (
                    <option value={code} key={code}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="metric-tabs" role="tablist" aria-label="Factory outcome metric">
            {FACTORY_METRICS.map((metric) => (
              <button
                key={metric}
                className={metricId === metric ? "active" : ""}
                onClick={() => setMetricId(metric)}
                role="tab"
                aria-selected={metricId === metric}
              >
                {data.metrics[metric].label}
              </button>
            ))}
          </div>
          <div className="factory-chart-layout">
            <div className="factory-chart">
              <LineChart
                series={chartSeries}
                format={selectedMetric.format === "percent" ? "percent" : "number"}
                peerRange={peerRange}
                policyYears={[
                  { year: 2014, label: "IP 2014" },
                  { year: 2021, label: "IP 2021" },
                ]}
                description={`${selectedMetric.label} in ${selectedSector.label}, Tamil Nadu against ${
                  data.states[peerState]
                }, 2008-09 to 2023-24`}
              />
              <div className="source-line">
                <Database size={14} aria-hidden /> MoSPI ASI weighted estimates · L = lakh (100,000) · Cr = crore (10
                million)
              </div>
            </div>
            <aside className="chart-reading">
              <span className="eyebrow">Reading this measure</span>
              <h3>{selectedMetric.label}</h3>
              <p>{selectedMetric.note}</p>
              <dl>
                <div>
                  <dt>Sector definition</dt>
                  <dd>{selectedSector.label}</dd>
                </div>
                <div>
                  <dt>Boundary</dt>
                  <dd>{selectedSector.limitation}</dd>
                </div>
                <div>
                  <dt>Prices</dt>
                  <dd>{metricId === "employees" ? "Not applicable" : "Ratio of same-year aggregates"}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section id="method" className="section-band method-band">
          <div className="section-header">
            <div>
              <span className="eyebrow">Method</span>
              <h2>Designed to survive scrutiny</h2>
            </div>
            <div className="method-header-note">
              <span className="validation-pass">
                <Check size={15} aria-hidden /> ASI benchmark tests passed
              </span>
              <ReadingNote>This section explains what was included, suppressed and deliberately rejected.</ReadingNote>
            </div>
          </div>
          <div className="method-grid">
            <article>
              <FileText size={21} aria-hidden />
              <h3>Targets, not rhetoric</h3>
              <p>
                Only state-level numeric outcome commitments enter the target ledger. Subsidy caps and project
                eligibility thresholds do not.
              </p>
            </article>
            <article>
              <ShieldCheck size={21} aria-hidden />
              <h3>Evidence before verdict</h3>
              <p>
                A pass/fail judgment appears only when target, geography, denominator and deadline align with an
                independent official series.
              </p>
            </article>
            <article>
              <Scale size={21} aria-hidden />
              <h3>ASI used within scope</h3>
              <p>
                Survey weights, NIC 2008 definitions and disclosure suppression are applied. Public identifiers do not
                support a factory panel. Not automatically used to score commitments.
              </p>
            </article>
            <article>
              <AlertTriangle size={21} aria-hidden />
              <h3>No causal overclaim</h3>
              <p>{data.metadata.causal_note} Peer states are context, not a counterfactual.</p>
            </article>
          </div>
          <div className="method-audit">
            <div>
              <span>Benchmark result</span>
              <strong>
                {data.benchmark_validation.records.length}/{data.benchmark_validation.records.length} checks pass
              </strong>
              <p>
                Rebuilt Tamil Nadu aggregates stay within the pre-set 5% tolerance of MoSPI&rsquo;s published tables
                across six survey years spanning every ASI schema era. Maximum deviation:{" "}
                {(data.metadata.asi_benchmark_max_error * 100).toFixed(2)}%.
              </p>
            </div>
            <div>
              <span>Disclosure rule</span>
              <strong>10-factory minimum</strong>
              <p>{data.metadata.disclosure_note}</p>
            </div>
            <div>
              <span>Rejected analyses</span>
              <strong>What we refused to build</strong>
              <p>
                A factory panel (public identifiers are masked) and a historical power-outage series (reporting breaks
                after 2017-18). Breaks in the record are not turned into claims.
              </p>
            </div>
          </div>
          <div className="source-footer">
            <div>
              <BookOpen size={16} aria-hidden />
              <span>Primary sources</span>
            </div>
            <a href={data.metadata.asi_source_url} target="_blank" rel="noreferrer">
              MoSPI ASI microdata <ExternalLink size={13} />
            </a>
            <a href="https://des.tn.gov.in/node/346" target="_blank" rel="noreferrer">
              Tamil Nadu DES state income <ExternalLink size={13} />
            </a>
            <a href={data.gsdp_archived.source_url} target="_blank" rel="noreferrer">
              MoSPI archived GSDP (2004-05 base) <ExternalLink size={13} />
            </a>
            <a href={data.solar.source_url} target="_blank" rel="noreferrer">
              MNRE capacity data <ExternalLink size={13} />
            </a>
            <a
              href="https://investingintamilnadu.com/business-in-tamil-nadu/policy-notifications"
              target="_blank"
              rel="noreferrer"
            >
              Guidance policy inventory <ExternalLink size={13} />
            </a>
          </div>
          <div className="site-colophon">
            <span>
              Data updated {data.metadata.updated} · Code MIT · Data CC BY 4.0 · Reproducible from source — every
              number regenerates from the scripts and manifests in the repository.
            </span>
          </div>
        </section>
      </main>

      <PolicyDrawer policy={selectedPolicy} data={data} onClose={() => setSelectedPolicy(null)} />
    </>
  );
}

export default function Home() {
  const [data, setData] = useState<ObservatoryData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/observatory.json")
      .then((response) => {
        if (!response.ok) throw new Error("Data request failed");
        return response.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error)
    return (
      <main className="loading-view">
        <AlertTriangle aria-hidden />
        <p>The public evidence file could not be loaded. Reload the page to try again.</p>
      </main>
    );
  if (!data) return <LoadingView />;
  return <App data={data} />;
}
