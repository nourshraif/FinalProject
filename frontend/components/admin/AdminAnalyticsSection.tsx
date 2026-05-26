"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Loader2,
  Briefcase,
  ClipboardList,
  Mail,
} from "lucide-react";
import { getAdminAnalytics, type AdminAnalytics } from "@/lib/api";

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#1a1a2e",
    border: "1px solid #2a2a3d",
    borderRadius: "8px",
    color: "#fff",
  },
  labelStyle: { color: "#94a3b8" },
};

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const USER_TYPE_COLORS: Record<string, string> = {
  jobseeker: "#6366f1",
  company: "#22c55e",
  admin: "#f59e0b",
};

const RADIAN = Math.PI / 180;

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  index?: number;
};

/** Integer % per slice that always sum to 100 (avoids 88 + 13 = 101 from separate rounding). */
function integerPercents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map((p) => Math.floor(p));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k].i] += 1;
  }
  return result;
}

function makePiePercentLabel(displayPercents: number[]) {
  return ({
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    index = 0,
  }: PieLabelProps) => {
    const pct = displayPercents[index] ?? 0;
    if (pct === 0) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {`${pct}%`}
      </text>
    );
  };
}

function pieTooltipWithPercent(total: number) {
  return (value: number, name: string) => {
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
    return [`${value} (${pct}%)`, name];
  };
}

type BreakdownRow = { label: string; count: number; color: string };

function PieChartBreakdown({
  rows,
  total,
  unitLabel,
}: {
  rows: BreakdownRow[];
  total: number;
  unitLabel: string;
}) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <ul className="space-y-2 rounded-lg bg-black/20 p-3">
        {rows.map((row) => {
          const exactPct = total > 0 ? ((row.count / total) * 100).toFixed(1) : "0.0";
          return (
            <li
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <span className="font-medium text-white">{row.label}</span>
              </span>
              <span className="text-vertex-muted">
                <span className="tabular-nums text-slate-200">{row.count}</span>
                {" · "}
                <span className="tabular-nums">{exactPct}% of total</span>
              </span>
            </li>
          );
        })}
        <li className="flex justify-between border-t border-white/10 pt-2 text-sm font-medium">
          <span className="text-slate-300">Total</span>
          <span className="tabular-nums text-white">
            {total} {unitLabel}
          </span>
        </li>
      </ul>
    </div>
  );
}

export function AdminAnalyticsSection({ token, showToast }: Props) {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getAdminAnalytics(token, days)
      .then(setData)
      .catch((e) => {
        setData(null);
        showToast(e instanceof Error ? e.message : "Failed to load analytics", "error");
      })
      .finally(() => setLoading(false));
  }, [token, days, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-vertex-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-sm text-vertex-muted py-12">
        Analytics could not be loaded.
      </p>
    );
  }

  const { revenue, plans } = data;
  const totalUsers = plans.free + plans.pro + plans.business;
  const conversionRate =
    totalUsers > 0 ? ((revenue.paid_users / totalUsers) * 100).toFixed(1) : "0";

  const userTypePie = data.user_types.map((u) => ({
    name: u.type === "company" ? "Companies" : u.type === "jobseeker" ? "Job seekers" : u.type,
    value: u.count,
    color: USER_TYPE_COLORS[u.type] || "#94a3b8",
  }));

  const planSlices = data.plan_distribution.filter((p) => p.count > 0);
  const planTotal = planSlices.reduce((s, p) => s + p.count, 0);
  const planDisplayPercents = integerPercents(planSlices.map((p) => p.count));

  const userTypeSlices = userTypePie.filter((p) => p.value > 0);
  const userTypeTotal = userTypeSlices.reduce((s, p) => s + p.value, 0);
  const userTypeDisplayPercents = integerPercents(userTypeSlices.map((p) => p.value));

  const planBreakdownRows: BreakdownRow[] = planSlices.map((p) => ({
    label: p.plan,
    count: p.count,
    color: p.color,
  }));
  const userTypeBreakdownRows: BreakdownRow[] = userTypeSlices.map((p) => ({
    label: p.name,
    count: p.value,
    color: p.color,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Revenue & analytics</h2>
          <p className="text-sm text-vertex-muted">
            Platform growth and estimated revenue over the last {data.period_days} days
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                days === d
                  ? "bg-vertex-accent text-white"
                  : "bg-white/5 text-vertex-muted hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Estimated MRR</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(revenue.estimated_mrr)}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#6366f1" }}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Estimated ARR</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(revenue.estimated_arr)}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#8b5cf6" }}>
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Paid users</p>
            <p className="text-xl font-bold text-white">{revenue.paid_users}</p>
            <p className="text-xs text-vertex-muted">
              Pro {plans.pro} · Business {plans.business}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 rounded-xl p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "#0ea5e9" }}>
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-vertex-muted">Paid conversion</p>
            <p className="text-xl font-bold text-white">{conversionRate}%</p>
            <p className="text-xs text-vertex-muted">{plans.free} on free</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-vertex-muted rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        {revenue.disclaimer} Pro @ {formatCurrency(revenue.pro_monthly_price)}/mo · Business @{" "}
        {formatCurrency(revenue.business_monthly_price)}/mo (from platform settings).
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-medium text-white">Plan distribution</h3>
          <p className="mt-1 text-xs text-vertex-muted">
            How many active users are on Free, Pro, or Business (billing tier).
          </p>
          {planSlices.length === 0 ? (
            <p className="py-8 text-center text-sm text-vertex-muted">No users yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240} className="mt-3">
                <PieChart>
                  <Pie
                    data={planSlices}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={planSlices.length > 1 ? 2 : 0}
                    label={makePiePercentLabel(planDisplayPercents)}
                    labelLine={false}
                  >
                    {planSlices.map((entry) => (
                      <Cell key={entry.plan} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={pieTooltipWithPercent(planTotal)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <PieChartBreakdown
                rows={planBreakdownRows}
                total={planTotal}
                unitLabel="users"
              />
            </>
          )}
        </div>

        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-medium text-white">User types (active)</h3>
          <p className="mt-1 text-xs text-vertex-muted">
            Active job seekers and companies on the platform.
          </p>
          {userTypeSlices.length === 0 ? (
            <p className="py-8 text-center text-sm text-vertex-muted">No users yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240} className="mt-3">
                <PieChart>
                  <Pie
                    data={userTypeSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    paddingAngle={userTypeSlices.length > 1 ? 2 : 0}
                    label={makePiePercentLabel(userTypeDisplayPercents)}
                    labelLine={false}
                  >
                    {userTypeSlices.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP}
                    formatter={pieTooltipWithPercent(userTypeTotal)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <PieChartBreakdown
                rows={userTypeBreakdownRows}
                total={userTypeTotal}
                unitLabel="accounts"
              />
            </>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-4">
        <h3 className="mb-1 text-sm font-medium text-white">New signups</h3>
        <p className="mb-4 text-xs text-vertex-muted">Job seekers vs companies per day</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.signups_by_type_over_time}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              stroke="#64748b"
              fontSize={11}
              interval="preserveStartEnd"
            />
            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
            <Tooltip {...CHART_TOOLTIP} labelFormatter={formatShortDate} />
            <Legend />
            <Bar dataKey="jobseekers" name="Job seekers" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
            <Bar dataKey="companies" name="Companies" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-vertex-accent" />
            <h3 className="text-sm font-medium text-white">User registrations</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.users_over_time}>
              <defs>
                <linearGradient id="adminUsersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} labelFormatter={formatShortDate} />
              <Area type="monotone" dataKey="count" name="Signups" stroke="#6366f1" fill="url(#adminUsersGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-medium text-white">Jobs scraped</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.jobs_over_time}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} labelFormatter={formatShortDate} />
              <Line type="monotone" dataKey="count" name="Jobs" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium text-white">Applications</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.applications_over_time}>
              <defs>
                <linearGradient id="adminAppsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} labelFormatter={formatShortDate} />
              <Area type="monotone" dataKey="count" name="Applications" stroke="#f59e0b" fill="url(#adminAppsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-medium text-white">Contact requests</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.contact_requests_over_time}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} labelFormatter={formatShortDate} />
              <Line type="monotone" dataKey="count" name="Requests" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.subscription_status.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="mb-4 text-sm font-medium text-white">Subscription records (Stripe table)</h3>
          <div className="flex flex-wrap gap-4">
            {data.subscription_status.map((s) => (
              <div key={s.status} className="rounded-lg bg-white/5 px-4 py-2">
                <p className="text-xs capitalize text-vertex-muted">{s.status}</p>
                <p className="text-lg font-semibold text-white">{s.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
