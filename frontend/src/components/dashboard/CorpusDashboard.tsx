"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Database, FlaskConical, Pill, Globe, Activity } from "lucide-react";

interface PhaseBucket { name: string; count: number; pct: number; }
interface NamedCount { name: string; count: number; }
interface CoverageBucket { count: number; pct: number; }

interface CorpusStats {
  totals: { trials: number; locations: number; interventions: number; countries: number };
  phase_distribution: PhaseBucket[];
  top_conditions: NamedCount[];
  top_countries: NamedCount[];
  parser_coverage?: {
    parsed_total: number;
    medications_excluded: CoverageBucket;
    lab_thresholds: CoverageBucket;
    ecog: CoverageBucket;
  };
  top_excluded_meds?: NamedCount[];
  top_lab_thresholds?: NamedCount[];
  generated_at: number;
  parser_version: string;
}

// Palette — Apple accent + cosmic (matches the rest of the app)
const PHASE_COLORS = ["#0071E3", "#2997FF", "#30D158", "#FF9F0A", "#FF3B30", "#A78BFA", "#6E6E73"];
const BAR_FILL = "#0071E3";
const BAR_FILL_WARM = "#FF9F0A";

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: { name?: string; pct?: number } }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const name = label || item.payload?.name || "";
  const value = item.value;
  const pct = item.payload?.pct;
  return (
    <div className="bg-white border border-line rounded-lg shadow-lg px-3 py-2 text-[12px]">
      <p className="font-semibold text-fg">{name}</p>
      <p className="text-fg-mute tabular">
        {value.toLocaleString()} trials
        {pct !== undefined && <span className="ml-2 text-fg-faint">· {pct}%</span>}
      </p>
    </div>
  );
}

export default function CorpusDashboard() {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/corpus-stats.json")
      .then((r) => {
        if (!r.ok) throw new Error("Stats not available");
        return r.json();
      })
      .then((data) => setStats(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) {
    return (
      <div className="bg-paper-alt rounded-2xl p-8 text-center text-fg-mute text-[14px]">
        Couldn&apos;t load corpus statistics.
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 bg-paper-alt rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  const cov = stats.parser_coverage;

  return (
    <div className="space-y-8">
      {/* Top-level counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Database} label="Trials indexed" value={stats.totals.trials.toLocaleString()} />
        <StatCard icon={Globe} label="Countries" value={stats.totals.countries.toLocaleString()} />
        <StatCard icon={Activity} label="Trial sites" value={stats.totals.locations.toLocaleString()} />
        <StatCard icon={FlaskConical} label="Interventions" value={stats.totals.interventions.toLocaleString()} />
      </div>

      {/* Row 1: Phase donut + Top conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Phase donut */}
        <ChartCard
          title="Trials by phase"
          subtitle="Distribution across clinical phases"
          className="lg:col-span-5"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.phase_distribution}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="none"
                >
                  {stats.phase_distribution.map((_, i) => (
                    <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipBox />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1 text-[11px]">
            {stats.phase_distribution.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }}
                  />
                  <span className="text-fg-mute truncate">{p.name}</span>
                </span>
                <span className="tabular text-fg-faint ml-2 flex-shrink-0">
                  {p.count.toLocaleString()} · {p.pct}%
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top conditions */}
        <ChartCard
          title="Most-studied conditions"
          subtitle={`${stats.top_conditions.length} leading MeSH-tagged conditions`}
          className="lg:col-span-7"
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.top_conditions.slice(0, 10)}
                layout="vertical"
                margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  stroke="#86868B"
                  tick={{ fontSize: 10, fill: "#86868B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  stroke="#6E6E73"
                  tick={{ fontSize: 11, fill: "#3B3B41" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "#F5F5F7" }} />
                <Bar dataKey="count" fill={BAR_FILL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Top countries + Parser coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <ChartCard
          title="Top trial locations"
          subtitle="Countries with the most active sites"
          className="lg:col-span-6"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.top_countries}
                layout="vertical"
                margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  stroke="#86868B"
                  tick={{ fontSize: 10, fill: "#86868B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  stroke="#6E6E73"
                  tick={{ fontSize: 11, fill: "#3B3B41" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipBox />} cursor={{ fill: "#F5F5F7" }} />
                <Bar dataKey="count" fill="#2997FF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Parser coverage */}
        {cov && (
          <ChartCard
            title="Parser extraction coverage"
            subtitle={`${cov.parsed_total.toLocaleString()} trials processed in 86 seconds`}
            className="lg:col-span-6"
          >
            <div className="py-4 space-y-6">
              <CoverageRow
                label="Medications excluded"
                icon={Pill}
                count={cov.medications_excluded.count}
                pct={cov.medications_excluded.pct}
                total={cov.parsed_total}
                color="#0071E3"
              />
              <CoverageRow
                label="Lab thresholds"
                icon={FlaskConical}
                count={cov.lab_thresholds.count}
                pct={cov.lab_thresholds.pct}
                total={cov.parsed_total}
                color="#30D158"
              />
              <CoverageRow
                label="ECOG performance status"
                icon={Activity}
                count={cov.ecog.count}
                pct={cov.ecog.pct}
                total={cov.parsed_total}
                color="#FF9F0A"
              />
            </div>
            <p className="text-[11px] text-fg-faint leading-relaxed mt-6 pt-4 border-t border-line-soft">
              The remaining trials use phrasings our rule-based parser doesn&apos;t catch.
              LLM fallback is the next step.
            </p>
          </ChartCard>
        )}
      </div>

      {/* Row 3: Excluded meds + Labs */}
      {stats.top_excluded_meds && stats.top_excluded_meds.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <ChartCard
            title="Most-excluded medications"
            subtitle="Drugs and drug classes most commonly named in exclusion criteria"
            className="lg:col-span-7"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.top_excluded_meds.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    stroke="#86868B"
                    tick={{ fontSize: 10, fill: "#86868B" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    stroke="#6E6E73"
                    tick={{ fontSize: 11, fill: "#3B3B41" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipBox />} cursor={{ fill: "#F5F5F7" }} />
                  <Bar dataKey="count" fill={BAR_FILL_WARM} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {stats.top_lab_thresholds && (
            <ChartCard
              title="Most-required lab tests"
              subtitle="Lab values with explicit numeric thresholds"
              className="lg:col-span-5"
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.top_lab_thresholds}
                    layout="vertical"
                    margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#86868B"
                      tick={{ fontSize: 10, fill: "#86868B" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="#6E6E73"
                      tick={{ fontSize: 11, fill: "#3B3B41" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<TooltipBox />} cursor={{ fill: "#F5F5F7" }} />
                    <Bar dataKey="count" fill="#30D158" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[11px] text-fg-faint text-center">
        Last aggregated {new Date(stats.generated_at * 1000).toLocaleDateString()}
        {" · "} Parser: <span className="font-mono">{stats.parser_version}</span>
        {" · "} Source: ClinicalTrials.gov API v2
      </p>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-line-soft rounded-[16px] p-5">
      <Icon className="w-4 h-4 text-fg-faint mb-3" strokeWidth={2} />
      <p className="text-[28px] font-semibold tabular tracking-tight leading-none mb-1">{value}</p>
      <p className="text-[12px] text-fg-mute">{label}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-line-soft rounded-[18px] p-6 ${className}`}>
      <h3 className="text-[16px] font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-[12px] text-fg-mute mb-5">{subtitle}</p>}
      {children}
    </div>
  );
}

function CoverageRow({
  label, icon: Icon, count, pct, total, color,
}: {
  label: string;
  icon: typeof Database;
  count: number;
  pct: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2.25} />
          <span className="text-[13px] font-medium text-fg">{label}</span>
        </div>
        <span className="text-[12px] tabular text-fg-mute">
          <span className="font-semibold text-fg">{count.toLocaleString()}</span>
          <span className="mx-1">/</span>
          {total.toLocaleString()}
          <span className="ml-2" style={{ color }}>{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-paper-alt rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
