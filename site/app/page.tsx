"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  Factory,
  FileCheck2,
  FlaskConical,
  Search,
  ShieldCheck,
  Target,
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
  benchmark_validation: {
    passed: boolean;
    tolerance: number;
    records: Array<{ year: number; metric: string; relative_error: number; pass: boolean }>;
  };
};

const EVIDENCE_META: Record<
  EvidenceClass,
  { short: string; label: string; className: string }
> = {
  independent_direct: {
    short: "Direct",
    label: "Independently testable",
    className: "evidence-direct",
  },
  independent_partial: {
    short: "Partial",
    label: "Independent partial measure",
    className: "evidence-partial",
  },
  official_proxy: {
    short: "Proxy",
    label: "Official proxy only",
    className: "evidence-proxy",
  },
  administrative_required: {
    short: "Admin",
    label: "Administrative records required",
    className: "evidence-admin",
  },
  directional: {
    short: "Directional",
    label: "No numeric test",
    className: "evidence-directional",
  },
};

const STATE_COLORS: Record<string, string> = {
  "33": "#007f73",
  "24": "#d65a34",
  "27": "#9c6f00",
  "29": "#456b9c",
  "06": "#75558f",
  "28": "#79857f",
  "36": "#af6675",
};

const FACTORY_METRICS = [
  "employees",
  "gva_output_ratio",
  "female_direct_worker_share",
  "contract_worker_share",
  "rd_gva_share",
  "training_factory_share",
];

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMetric(value: number | null | undefined, format = "count") {
  if (value == null || !Number.isFinite(value)) return "Not available";
  if (format === "percent") return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
  return compactNumber(value);
}

function statusLabel(status: string) {
  return status.replaceAll("-", " ");
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

function ReadingNote({ children }: { children: ReactNode }) {
  return <p className="reading-note"><CircleHelp size={16} /> <span><strong>How to read it</strong>{children}</span></p>;
}

function MiniBadge({ evidence }: { evidence: EvidenceClass }) {
  const meta = EVIDENCE_META[evidence];
  return <span className={`mini-badge ${meta.className}`}>{meta.short}</span>;
}

function LoadingView() {
  return (
    <main className="loading-view">
      <div className="loading-mark">TN</div>
      <p>Loading the policy evidence ledger…</p>
    </main>
  );
}

function EvidenceStack({ data }: { data: ObservatoryData }) {
  const keys: EvidenceClass[] = [
    "independent_direct",
    "independent_partial",
    "official_proxy",
    "administrative_required",
  ];
  return (
    <div className="evidence-stack" aria-label="Target evidence distribution">
      <div className="evidence-stack-bar">
        {keys.map((key) => {
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
        {keys.map((key) => (
          <div key={key}>
            <i className={EVIDENCE_META[key].className} />
            <span>{EVIDENCE_META[key].short}</span>
            <strong>{data.metadata.evidence_counts[key] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type Point = { year: number; label: string; value: number | null };

function LineChart({
  series,
  format = "number",
  targetLines = [],
  policyYears = [],
  peerRange,
}: {
  series: Array<{ id: string; label: string; color: string; points: Point[] }>;
  format?: "number" | "percent" | "percentagePoint";
  targetLines?: Array<{ value: number; label: string; color: string }>;
  policyYears?: Array<{ year: number; label: string }>;
  peerRange?: Array<{ year: number; low: number; high: number }>;
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
          ASI cells are withheld when the public microdata do not support a disclosure-safe estimate. This is an evidence gap, not a zero.
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
  minValue = Math.max(0, minValue - range * 0.12);
  maxValue += range * 0.14;
  const x = (year: number) => pad.left + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((maxValue - value) / (maxValue - minValue)) * (height - pad.top - pad.bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => minValue + ((maxValue - minValue) * index) / 4).reverse();

  const display = (value: number) => {
    if (format === "percent") return `${(value * 100).toFixed(1)}%`;
    if (format === "percentagePoint") return `${value.toFixed(1)}%`;
    return compactNumber(value);
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

  return (
    <div className="chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Time series chart">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid-line" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="axis-label">
              {display(tick)}
            </text>
          </g>
        ))}
        {[minYear, Math.round((minYear + maxYear) / 2), maxYear].map((year) => (
          <text key={year} x={x(year)} y={height - 14} textAnchor="middle" className="axis-label">
            {year}-{String(year + 1).slice(-2)}
          </text>
        ))}
        {rangePath && <path d={rangePath} className="peer-range" />}
        {policyYears.map((marker) => (
          <g key={`${marker.year}-${marker.label}`}>
            <line x1={x(marker.year)} x2={x(marker.year)} y1={pad.top} y2={height - pad.bottom} className="policy-marker" />
            <text x={x(marker.year) + 5} y={pad.top + 10} className="policy-marker-label">
              {marker.label}
            </text>
          </g>
        ))}
        {targetLines.map((target) => (
          <g key={target.label}>
            <line x1={pad.left} x2={width - pad.right} y1={y(target.value)} y2={y(target.value)} stroke={target.color} className="target-line" />
            <text x={width - pad.right} y={y(target.value) - 6} textAnchor="end" fill={target.color} className="target-label">
              {target.label}
            </text>
          </g>
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
                  r="7"
                  className="hover-point"
                  onMouseEnter={() => setHovered({ x: x(point.year), point, series: item.label })}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
          </g>
        ))}
        {hovered && hovered.point.value != null && (
          <g className="chart-tooltip" transform={`translate(${Math.min(hovered.x + 10, width - 180)},${Math.max(y(hovered.point.value) - 56, 8)})`}>
            <rect width="164" height="48" rx="4" />
            <text x="10" y="18">{hovered.series} · {hovered.point.label}</text>
            <text x="10" y="37" className="tooltip-value">{display(hovered.point.value)}</text>
          </g>
        )}
      </svg>
      <div className="series-legend">
        {series.map((item) => (
          <span key={item.id}><i style={{ background: item.color }} />{item.label}</span>
        ))}
        {peerRange && <span><i className="range-key" />Peer range</span>}
      </div>
    </div>
  );
}

function SolarGauge({ data }: { data: ObservatoryData }) {
  const circumference = 2 * Math.PI * 74;
  const achieved = Math.min(100, data.solar.achievement_pct);
  return (
    <div className="solar-gauge">
      <svg viewBox="0 0 180 180" aria-label={`${achieved.toFixed(1)} percent of solar target achieved`}>
        <circle cx="90" cy="90" r="74" className="gauge-track" />
        <circle
          cx="90"
          cy="90"
          r="74"
          className="gauge-progress"
          strokeDasharray={`${(circumference * achieved) / 100} ${circumference}`}
        />
      </svg>
      <div>
        <strong>{achieved.toFixed(1)}%</strong>
        <span>of target</span>
      </div>
    </div>
  );
}

function PolicyTimeline({ policies, onSelect }: { policies: Policy[]; onSelect: (policy: Policy) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<number, Policy[]>();
    policies.forEach((policy) => map.set(policy.year, [...(map.get(policy.year) ?? []), policy]));
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [policies]);

  return (
    <div className="policy-chronology">
      {grouped.map(([year, yearPolicies]) => (
        <div className="chronology-year" key={year}>
          <div className="chronology-date">
            <strong>{year}</strong>
            <span>{yearPolicies.length} {yearPolicies.length === 1 ? "policy" : "policies"}</span>
          </div>
          <div className="chronology-policies">
            {yearPolicies.map((policy) => {
              const evidence = evidenceForPolicy(policy);
              return (
                <button key={policy.id} onClick={() => onSelect(policy)}>
                  <span className="chronology-topline"><MiniBadge evidence={evidence} /> {policy.targets.length ? `${policy.targets.length} commitments` : "No numeric commitment"}</span>
                  <strong>{policy.title}</strong>
                  <span className="chronology-sector">{policy.sector}</span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
            <span className="eyebrow">{policy.year} · {policy.sector}</span>
            <h2>{policy.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close"><X size={19} /></button>
        </header>
        <div className="drawer-body">
          <div className="drawer-status-row">
            <span>{statusLabel(policy.status)}</span>
            <span>{policy.targets.length} headline {policy.targets.length === 1 ? "target" : "targets"}</span>
          </div>
          <p className="coverage-note">{policy.coverage_note}</p>

          {policy.targets.length ? (
            <section className="target-list">
              <h3>Outcome commitments</h3>
              {policy.targets.map((target) => (
                <article key={target.id}>
                  <div className="target-heading">
                    <MiniBadge evidence={target.evidence_class} />
                    {target.verdict && <span className={`verdict verdict-${target.verdict}`}>{statusLabel(target.verdict)}</span>}
                  </div>
                  <div className="verification-status"><Check size={15} /><span>{evidenceState(target)}</span></div>
                  <div className="verification-chain">
                    <div className="verification-step">
                      <span>1</span>
                      <div><small>Promise</small><h4>{target.statement}</h4><a href={`${policy.source_url}#page=${target.page}`} target="_blank" rel="noreferrer">Policy PDF, page {target.page} <ExternalLink size={12} /></a></div>
                    </div>
                    <div className="verification-step">
                      <span>2</span>
                      <div><small>Outcome evidence</small><p>{target.outcome_dataset}</p>{evidenceSource(target, data).url ? <a href={evidenceSource(target, data).url!} target="_blank" rel="noreferrer">{evidenceSource(target, data).label} <ExternalLink size={12} /></a> : <em>Required record is not published as a usable public series.</em>}</div>
                    </div>
                    <div className="verification-step">
                      <span>3</span>
                      <div><small>Decision rule</small><p>{comparisonRule(target)}</p></div>
                    </div>
                    <div className="verification-step verification-result">
                      <span>4</span>
                      <div><small>{target.verdict ? "Result" : "Why no verdict"}</small><p>{target.assessment}</p></div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="no-target-state">
              <CircleHelp size={22} />
              <div><strong>No headline numeric outcome</strong><p>Eligibility thresholds and subsidy amounts are not counted as policy targets.</p></div>
            </div>
          )}

          {policy.asi_summary && (
            <section className="asi-snapshot">
              <div className="snapshot-heading"><div><h3>Registered-factory context</h3><span>Not automatically used to score the commitments above</span></div><MiniBadge evidence="independent_partial" /></div>
              <div className="snapshot-grid">
                <div><span>People engaged</span><strong>{formatMetric(policy.asi_summary.latest.employees)}</strong></div>
                <div><span>Value-added share</span><strong>{formatMetric(policy.asi_summary.latest.gva_output_ratio, "percent")}</strong></div>
                <div><span>Women, direct workers</span><strong>{formatMetric(policy.asi_summary.latest.female_direct_worker_share, "percent")}</strong></div>
                <div><span>Latest year</span><strong>{policy.asi_summary.latest_year}</strong></div>
              </div>
              <p>{policy.asi_sector_label}. Cell stability: {policy.asi_summary.stability}; {policy.asi_summary.sample_factories.toLocaleString("en-IN")} sampled factories. {policy.coverage_note}</p>
              <a href={data.metadata.asi_source_url} target="_blank" rel="noreferrer">Open ASI source catalogue <ExternalLink size={12} /></a>
            </section>
          )}
        </div>
        <footer>
          <a href={policy.source_url} target="_blank" rel="noreferrer">
            Open policy PDF <ExternalLink size={15} />
          </a>
          <span>{["official", "official-state-agency"].includes(policy.source_tier) ? "Government-hosted source" : "Official policy · external document archive"}</span>
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
      color: "#007f73",
      points: data.gsva.map((row) => ({ year: row.year, label: row.year_label, value: row.real_growth_pct })),
    },
    {
      id: "nominal",
      label: "Nominal growth",
      color: "#d65a34",
      points: data.gsva.map((row) => ({ year: row.year, label: row.year_label, value: row.current_growth_pct })),
    },
  ];

  const selectedRecords = data.asi_records.filter((record) => record.sector_id === sectorId);
  const chartSeries = ["33", peerState].map((state) => ({
    id: state,
    label: data.states[state],
    color: STATE_COLORS[state],
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
    return Array.from(new Set(selectedRecords.map((record) => record.year))).sort().map((year) => {
      const values = selectedRecords
        .filter((record) => record.year === year && peers.includes(record.state) && typeof record[metricId] === "number")
        .map((record) => record[metricId] as number);
      return values.length ? { year, low: Math.min(...values), high: Math.max(...values) } : null;
    }).filter((row): row is { year: number; low: number; high: number } => row != null);
  }, [data.states, metricId, selectedRecords]);

  const selectedSector = data.sectors.find((sector) => sector.id === sectorId)!;
  const selectedMetric = data.metrics[metricId];
  const directTargetCount = data.metadata.evidence_counts.independent_direct ?? 0;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top"><span>TN</span><strong>Policy Outcomes Observatory</strong></a>
        <nav aria-label="Primary navigation">
          <a href="#how-to-read">How to read</a>
          <a href="#findings">Findings</a>
          <a href="#policies">Policies</a>
          <a href="#factories">Factory outcomes</a>
          <a href="#method">Method</a>
        </nav>
        <a className="icon-button" href="/data/observatory.json" title="Download public data" download>
          <ArrowDownToLine size={18} />
        </a>
      </header>

      <main id="top">
        <section className="overview-band">
          <div className="overview-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> Public evidence · policy by policy</span>
            <h1>Tamil Nadu Industrial Policy Outcomes Observatory</h1>
            <p>What was promised, what official data can show, and where a verdict would overreach.</p>
            <div className="headline-stats">
              <div><strong>{data.metadata.policy_count}</strong><span>policies<br />2007–26</span></div>
              <div><strong>{data.metadata.target_count}</strong><span>headline<br />commitments</span></div>
              <div><strong>{directTargetCount}</strong><span>directly<br />testable</span></div>
              <div><strong>16</strong><span>ASI survey<br />years</span></div>
            </div>
          </div>
          <div className="overview-evidence">
            <div className="panel-heading">
              <div><span className="section-index">01</span><h2>How much can be independently tested?</h2></div>
              <Target size={22} />
            </div>
            <EvidenceStack data={data} />
            <p>Only {directTargetCount} of {data.metadata.target_count} numeric commitments have a directly comparable independent series. That is a finding, not a missing-data footnote.</p>
          </div>
        </section>

        <section id="how-to-read" className="reading-map">
          <div className="reading-map-heading">
            <span className="eyebrow">The logic of the observatory</span>
            <h2>One policy promise. Four checks.</h2>
            <p>A verdict is the end of the chain, not the starting point.</p>
          </div>
          <div className="reading-steps">
            <div><span>01</span><strong>Read the promise</strong><p>What exactly did the policy commit to, for whom, and by when?</p></div>
            <ArrowRight size={18} />
            <div><span>02</span><strong>Find the outcome</strong><p>Is there a published series measuring the same thing in Tamil Nadu?</p></div>
            <ArrowRight size={18} />
            <div><span>03</span><strong>Test the match</strong><p>Do geography, denominator, deadline and price basis line up?</p></div>
            <ArrowRight size={18} />
            <div><span>04</span><strong>Issue or withhold a verdict</strong><p>If any essential link fails, the honest result is “not verifiable.”</p></div>
          </div>
        </section>

        <section id="findings" className="section-band findings-band">
          <div className="section-header">
            <div><span className="section-index">02</span><span className="eyebrow">Strongest current findings</span><h2>Three claims the data can support</h2></div>
            <ReadingNote>These are target checks, not claims that the policy caused the outcome.</ReadingNote>
          </div>
          <div className="finding-list">
            <article>
              <span className="finding-number">1</span>
              <div><span className="finding-status status-alert"><AlertTriangle size={14} /> Below target</span><h3>Manufacturing growth has not reached the 2021 policy’s 15% annual goal.</h3><p>From 2020-21 to 2023-24, manufacturing GSVA grew at 13.4% nominal CAGR and 8.3% real CAGR. The policy does not specify which price basis applies.</p></div>
              <strong>8.3%<small>real CAGR</small></strong>
            </article>
            <article>
              <span className="finding-number">2</span>
              <div><span className="finding-status status-clock"><Clock3 size={14} /> Not yet due</span><h3>Manufacturing’s GSVA share is below the 30% goal for 2030.</h3><p>In 2023-24 it was 18.57% at current prices and 24.10% at constant prices. Both definitions are shown because the policy does not choose one.</p></div>
              <strong>18.57%<small>current-price share</small></strong>
            </article>
            <article>
              <span className="finding-number">3</span>
              <div><span className="finding-status status-alert"><AlertTriangle size={14} /> Target not met</span><h3>Tamil Nadu reached three-quarters of its 2023 solar-capacity target.</h3><p>MNRE recorded 6,736.43 MW against the policy target of 9,000 MW. The consumer-category sub-target is not scored because definitions do not align.</p></div>
              <strong>74.85%<small>target achieved</small></strong>
            </article>
          </div>
        </section>

        <section className="section-band evidence-detail-band">
          <div className="chart-panel growth-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Manufacturing GSVA</span><h2>Growth against the policy thresholds</h2></div>
              <BarChart3 size={22} />
            </div>
            <LineChart
              series={gsvaSeries}
              format="percentagePoint"
              targetLines={[
                { value: 14, label: "2014 policy: 14%", color: "#9c6f00" },
                { value: 15, label: "2021 policy: 15%", color: "#75558f" },
              ]}
              policyYears={[{ year: 2014, label: "2014 policy" }, { year: 2021, label: "2021 policy" }]}
            />
            <ReadingNote>Each point is one year’s manufacturing growth. Dashed lines are policy thresholds. Below a line means observed growth was lower, not that the policy caused the difference.</ReadingNote>
            <div className="source-line"><Database size={14} /> Tamil Nadu Department of Economics and Statistics · 2011-12 base · latest years are revised/quick/advance estimates</div>
          </div>
          <div className="solar-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">Solar Policy 2019</span><h2>Installed capacity by the deadline</h2></div>
              <Target size={22} />
            </div>
            <SolarGauge data={data} />
            <ReadingNote>The ring is actual installed capacity divided by the 9,000 MW deadline target. This is a direct target comparison.</ReadingNote>
            <div className="solar-numbers">
              <div><span>Actual</span><strong>{data.solar.actual_total_solar_mw.toLocaleString("en-IN")} MW</strong></div>
              <div><span>Target</span><strong>{data.solar.target_mw.toLocaleString("en-IN")} MW</strong></div>
              <div><span>Shortfall</span><strong>{data.solar.shortfall_mw.toLocaleString("en-IN")} MW</strong></div>
            </div>
            <a href={data.solar.source_url} target="_blank" rel="noreferrer">MNRE source <ExternalLink size={14} /></a>
          </div>
        </section>

        <section id="policies" className="section-band policies-band">
          <div className="section-header">
            <div><span className="section-index">03</span><span className="eyebrow">Policy chronology</span><h2>Two decades of industrial ambition</h2></div>
            <ReadingNote>Each row is a policy year. Open any policy to see the claim-to-source verification chain for every commitment.</ReadingNote>
          </div>
          <PolicyTimeline policies={data.policies} onSelect={setSelectedPolicy} />

          <div className="ledger-heading">
            <div><h3>Policy evidence ledger</h3><span>{filteredPolicies.length} of {data.policies.length}</span></div>
            <div className="ledger-controls">
              <label className="search-control"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search policy or sector" /></label>
              <select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value as "all" | EvidenceClass)} aria-label="Filter by evidence class">
                <option value="all">All evidence routes</option>
                {(Object.keys(EVIDENCE_META) as EvidenceClass[]).map((key) => <option value={key} key={key}>{EVIDENCE_META[key].label}</option>)}
              </select>
            </div>
          </div>
          <div className="policy-table" role="table" aria-label="Policy evidence ledger">
            <div className="policy-table-head" role="row">
              <span>Year</span><span>Policy</span><span>Evidence route</span><span>Targets</span><span />
            </div>
            {filteredPolicies.map((policy) => {
              const evidence = evidenceForPolicy(policy);
              return (
                <button className="policy-row" role="row" key={policy.id} onClick={() => setSelectedPolicy(policy)}>
                  <span>{policy.year}</span>
                  <span><strong>{policy.title}</strong><small>{policy.sector}</small></span>
                  <span><MiniBadge evidence={evidence} />{EVIDENCE_META[evidence].label}</span>
                  <span>{policy.targets.length || "—"}</span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </div>
        </section>

        <section id="factories" className="section-band factories-band">
          <div className="section-header">
            <div><span className="section-index">04</span><span className="eyebrow">Factory outcomes</span><h2>What changed inside registered manufacturing?</h2></div>
            <ReadingNote>Use this to inspect direction and scale among registered factories. Peer states provide context, not a counterfactual.</ReadingNote>
          </div>
          <div className="factory-controls">
            <label><span>Sector</span><select value={sectorId} onChange={(event) => setSectorId(event.target.value)}>{data.sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.label}</option>)}</select></label>
            <label><span>Comparison state</span><select value={peerState} onChange={(event) => setPeerState(event.target.value)}>{Object.entries(data.states).filter(([code]) => code !== "33").map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
          </div>
          <div className="metric-tabs" role="tablist" aria-label="Factory outcome metric">
            {FACTORY_METRICS.map((metric) => (
              <button key={metric} className={metricId === metric ? "active" : ""} onClick={() => setMetricId(metric)} role="tab" aria-selected={metricId === metric}>{data.metrics[metric].label}</button>
            ))}
          </div>
          <div className="factory-chart-layout">
            <div className="factory-chart">
              <LineChart series={chartSeries} format={selectedMetric.format === "percent" ? "percent" : "number"} peerRange={peerRange} policyYears={[{ year: 2014, label: "IP 2014" }, { year: 2021, label: "IP 2021" }]} />
            </div>
            <aside className="chart-reading">
              <span className="eyebrow">Reading this measure</span>
              <h3>{selectedMetric.label}</h3>
              <p>{selectedMetric.note}</p>
              <dl>
                <div><dt>Sector definition</dt><dd>{selectedSector.label}</dd></div>
                <div><dt>Boundary</dt><dd>{selectedSector.limitation}</dd></div>
                <div><dt>Prices</dt><dd>{metricId === "employees" ? "Not applicable" : "Ratio of same-year aggregates"}</dd></div>
              </dl>
            </aside>
          </div>
        </section>

        <section id="method" className="section-band method-band">
          <div className="section-header">
            <div><span className="section-index">05</span><span className="eyebrow">Method</span><h2>Designed to survive scrutiny</h2></div>
            <div className="method-header-note"><span className="validation-pass"><Check size={15} /> ASI benchmark tests passed</span><ReadingNote>This section explains what was included, suppressed and deliberately rejected.</ReadingNote></div>
          </div>
          <div className="method-grid">
            <article><FileCheck2 size={21} /><h3>Targets, not rhetoric</h3><p>Only state-level numeric outcome commitments enter the target ledger. Subsidy caps and project eligibility thresholds do not.</p></article>
            <article><ShieldCheck size={21} /><h3>Evidence before verdict</h3><p>A pass/fail judgment appears only when target, geography, denominator and deadline align with an independent official series.</p></article>
            <article><Factory size={21} /><h3>ASI used within scope</h3><p>Survey weights, NIC 2008 definitions and disclosure suppression are applied. Public identifiers do not support a factory panel.</p></article>
            <article><FlaskConical size={21} /><h3>No causal overclaim</h3><p>{data.metadata.causal_note} Peer states are context, not a counterfactual.</p></article>
          </div>
          <div className="method-audit">
            <div>
              <span>Benchmark result</span>
              <strong>{data.benchmark_validation.records.length}/{data.benchmark_validation.records.length} checks pass</strong>
              <p>Rebuilt Tamil Nadu aggregates stay within the pre-set 5% tolerance of MoSPI’s published tables. Maximum deviation: {(data.metadata.asi_benchmark_max_error * 100).toFixed(2)}%.</p>
            </div>
            <div>
              <span>Disclosure rule</span>
              <strong>10-factory minimum</strong>
              <p>{data.metadata.disclosure_note}</p>
            </div>
            <div>
              <span>Rejected analysis</span>
              <strong>Historical outage series</strong>
              <p>ASI unmet-demand records have reporting breaks and disappear after 2017-18. The observatory does not turn those breaks into a power-reliability claim.</p>
            </div>
          </div>
          <div className="source-footer">
            <div><BookOpen size={16} /><span>Primary sources</span></div>
            <a href={data.metadata.asi_source_url} target="_blank" rel="noreferrer">MoSPI ASI microdata <ExternalLink size={13} /></a>
            <a href="https://des.tn.gov.in/node/346" target="_blank" rel="noreferrer">Tamil Nadu DES state income <ExternalLink size={13} /></a>
            <a href={data.solar.source_url} target="_blank" rel="noreferrer">MNRE capacity data <ExternalLink size={13} /></a>
            <a href="https://investingintamilnadu.com/business-in-tamil-nadu/policy-notifications" target="_blank" rel="noreferrer">Guidance policy inventory <ExternalLink size={13} /></a>
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

  if (error) return <main className="loading-view"><AlertTriangle /><p>The public evidence file could not be loaded.</p></main>;
  if (!data) return <LoadingView />;
  return <App data={data} />;
}
