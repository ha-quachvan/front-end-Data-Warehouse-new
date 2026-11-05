import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  Database,
  Info,
  Package,
  RotateCcw,
  ShoppingBag,
  Star,
  Truck,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type DeliveryRoute,
  type DeliveryTrendRow,
  type KpiSummary,
  type RevenueFilters,
  type RevenueRow,
  type ReviewByDelay,
  type TopProduct,
} from "../api";
import {
  ChartLegend,
  DataState,
  DataTable,
  PageHeading,
  PanelHeading,
  RecordId,
  SectionHeading,
  SelectField,
  TableFootnote,
  type Column,
} from "../components/Dashboard";
import { downloadCsv } from "../components/ListTools";
import {
  categoryName,
  delayBucketName,
  regionName,
  stateName,
} from "../utils/format";
import {
  axisStyle,
  compactMoney,
  count,
  money,
  monthLabel,
  percent,
  tooltipStyle,
} from "../utils/display";

function sumBy(rows: RevenueRow[], key: (row: RevenueRow) => string) {
  const sums = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r);
    sums.set(k, (sums.get(k) ?? 0) + Number(r.total_revenue));
  });
  return [...sums].map(([label, total_revenue]) => ({ label, total_revenue }));
}
const uniq = (values: (string | number | null)[]) =>
  [...new Set(values.filter((v) => v !== null).map(String))].sort();
const numeric = (v: number) => Number(v).toFixed(1);
const routeColumns: Column<DeliveryRoute>[] = [
  {
    key: "seller",
    label: "Seller state",
    value: (r) => r.seller_state,
    render: (r) => stateName(r.seller_state),
  },
  {
    key: "customer",
    label: "Customer state",
    value: (r) => r.customer_state,
    render: (r) => stateName(r.customer_state),
  },
  {
    key: "orders",
    label: "Orders",
    value: (r) => Number(r.delivered_orders),
    numeric: true,
    render: (r) => count(r.delivered_orders),
  },
  {
    key: "late",
    label: "Late rate",
    value: (r) => Number(r.late_rate),
    numeric: true,
    render: (r) => (
      <span className="rate-badge high">{percent(r.late_rate)}</span>
    ),
  },
  {
    key: "delivery",
    label: "Avg. delivery",
    value: (r) => Number(r.avg_delivery_days),
    numeric: true,
    render: (r) => (
      <>
        {numeric(r.avg_delivery_days)} <span className="muted">days</span>
      </>
    ),
  },
  {
    key: "estimated",
    label: "Avg. estimated",
    value: (r) => Number(r.avg_estimated_days),
    numeric: true,
    render: (r) => (
      <>
        {numeric(r.avg_estimated_days)} <span className="muted">days</span>
      </>
    ),
  },
  {
    key: "low",
    label: "Low rating rate",
    value: (r) => Number(r.low_review_rate),
    numeric: true,
    render: (r) => percent(r.low_review_rate),
  },
];
const productColumns: Column<TopProduct>[] = [
  {
    key: "id",
    label: "Product ID",
    value: (p) => p.product_id,
    render: (p) => <RecordId value={p.product_id} />,
  },
  {
    key: "category",
    label: "Category",
    value: (p) => p.category,
    render: (p) => (
      <span className="category-tag">{categoryName(p.category)}</span>
    ),
  },
  {
    key: "revenue",
    label: "Revenue",
    value: (p) => Number(p.total_revenue),
    numeric: true,
    render: (p) => (
      <strong className="table-amount">
        {money(Number(p.total_revenue), 2)}
      </strong>
    ),
  },
  {
    key: "quantity",
    label: "Quantity",
    value: (p) => Number(p.total_quantity),
    numeric: true,
  },
  {
    key: "orders",
    label: "Orders",
    value: (p) => Number(p.total_orders),
    numeric: true,
  },
  {
    key: "rating",
    label: "Average rating",
    value: (p) =>
      p.avg_review_score === null ? null : Number(p.avg_review_score),
    numeric: true,
    render: (p) =>
      p.avg_review_score === null ? (
        "—"
      ) : (
        <span className="rating-cell">
          <Star size={14} fill="#f5b84b" color="#f5b84b" />
          {numeric(p.avg_review_score)} <span className="muted">/ 5</span>
        </span>
      ),
  },
];
function DeliverySection() {
  const [data, setData] = useState<{
    trend: DeliveryTrendRow[];
    routes: DeliveryRoute[];
    delay: ReviewByDelay[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setError(false);
    setData(null);
    Promise.all([
      api.deliveryTrend(),
      api.deliveryRoutes(10),
      api.reviewByDelay(),
    ])
      .then(([trend, routes, delay]) => {
        if (!stale) setData({ trend, routes, delay });
      })
      .catch(() => {
        if (!stale) setError(true);
      });
    return () => {
      stale = true;
    };
  }, [attempt]);
  const trend =
    data?.trend
      .map((r) => ({
        ...r,
        label: `${r.year}-${String(r.month).padStart(2, "0")}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)) ?? [];
  return (
    <section className="dashboard-section">
      <SectionHeading
        icon={Truck}
        title="Delivery & customer satisfaction"
        aside="Full dataset"
      />
      {!data ? (
        <div className="surface">
          <DataState
            status={error ? "error" : "loading"}
            title={error ? "Unable to load delivery data" : undefined}
            description={
              error ? "Check the backend connection and try again." : undefined
            }
            retry={error ? () => setAttempt((n) => n + 1) : undefined}
          />
        </div>
      ) : (
        <>
          <div className="surface chart-panel">
            <PanelHeading
              title="Delivery delays & low ratings over time"
              description="Share of orders by purchase month · Low rating = 1 or 2 stars"
              aside={
                <ChartLegend
                  items={[
                    { label: "Late delivery", color: "#ee8a55" },
                    { label: "Low rating", color: "#2563eb" },
                  ]}
                />
              }
            />
            {!trend.length ? (
              <DataState status="empty" />
            ) : (
              <div className="chart chart-satisfaction">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trend}
                    margin={{ top: 10, right: 15, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickFormatter={monthLabel}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={(v) => percent(v)}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => monthLabel(String(v))}
                      formatter={(v: number, name: string) => [
                        percent(v),
                        name,
                      ]}
                    />
                    <Line
                      name="Late delivery"
                      type="monotone"
                      dataKey="late_rate"
                      stroke="#ee8a55"
                      dot={false}
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                    <Line
                      name="Low rating"
                      type="monotone"
                      dataKey="low_review_rate"
                      stroke="#2563eb"
                      dot={false}
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="surface chart-panel delay-panel">
            <PanelHeading
              title="Low ratings by delivery delay"
              description="How delivery timing relates to the share of 1- and 2-star reviews"
            />
            {!data.delay.length ? (
              <DataState status="empty" />
            ) : (
              <div className="chart chart-delay">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.delay}
                    margin={{ top: 8, right: 12, left: 0, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={delayBucketName}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => percent(v)}
                      domain={[0, 1]}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(v) => delayBucketName(String(v))}
                      formatter={(v: number) => [percent(v), "Low rating rate"]}
                    />
                    <Bar
                      dataKey="low_review_rate"
                      radius={[5, 5, 0, 0]}
                      isAnimationActive={false}
                      maxBarSize={85}
                    >
                      {data.delay.map((r, i) => (
                        <Cell
                          key={r.bucket}
                          fill={
                            i === data.delay.length - 1
                              ? "#2563eb"
                              : i > 2
                                ? "#5185ed"
                                : "#95b5fa"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="surface table-panel">
            <PanelHeading
              title="Top 10 routes by late delivery rate"
              description="Seller state → customer state · Routes with at least 200 orders"
              aside={
                <span className="small-pill">{data.routes.length} routes</span>
              }
            />
            {!data.routes.length ? (
              <DataState status="empty" />
            ) : (
              <DataTable
                rows={data.routes}
                columns={routeColumns}
                rowKey={(r) => `${r.seller_state}-${r.customer_state}`}
                label="Delivery routes"
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
export default function ManagerDashboard() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [allRevenue, setAllRevenue] = useState<RevenueRow[]>([]);
  const [slowProducts, setSlowProducts] = useState<TopProduct[] | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialAttempt, setInitialAttempt] = useState(0);
  const [filters, setFilters] = useState<RevenueFilters>({});
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [revenueAttempt, setRevenueAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setInitialError(null);
    const failed = (e: unknown) => {
      if (!stale) setInitialError(String(e));
    };
    api
      .kpiSummary()
      .then((k) => {
        if (!stale) setKpi(k);
      })
      .catch(failed);
    api
      .revenueTrend()
      .then((r) => {
        if (!stale) setAllRevenue(r);
      })
      .catch(failed);
    api
      .topProducts(10, true)
      .then((p) => {
        if (!stale) setSlowProducts(p);
      })
      .catch(failed);
    return () => {
      stale = true;
    };
  }, [initialAttempt]);
  useEffect(() => {
    let stale = false;
    setRevenueLoading(true);
    setRevenueError(null);
    api
      .revenueTrend(filters)
      .then((rows) => {
        if (!stale) setRevenue(rows);
      })
      .catch((e) => {
        if (!stale) {
          setRevenue([]);
          setRevenueError(String(e));
        }
      })
      .finally(() => {
        if (!stale) setRevenueLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [filters, revenueAttempt]);
  const months = useMemo(
    () =>
      sumBy(
        revenue,
        (r) => `${r.year}-${String(r.month).padStart(2, "0")}`,
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [revenue],
  );
  const states = useMemo(
    () =>
      sumBy(revenue, (r) => r.state ?? "Unknown").sort(
        (a, b) => b.total_revenue - a.total_revenue,
      ),
    [revenue],
  );
  const periods = uniq(
    allRevenue.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`),
  );
  const dateRange = periods.length
    ? `${monthLabel(periods[0])} – ${monthLabel(periods[periods.length - 1])}`
    : "Purchase periods unavailable";
  const total = revenue.reduce((sum, r) => sum + Number(r.total_revenue), 0);
  const exportReport = () =>
    downloadCsv(
      revenue,
      [
        { header: "Year", value: (r) => r.year },
        { header: "Month", value: (r) => r.month },
        { header: "Category", value: (r) => categoryName(r.category) },
        {
          header: "Region",
          value: (r) => (r.region ? regionName(r.region) : null),
        },
        { header: "State", value: (r) => stateName(r.state) },
        { header: "Revenue (BRL)", value: (r) => Number(r.total_revenue) },
        { header: "Quantity", value: (r) => Number(r.total_quantity) },
        { header: "Orders", value: (r) => Number(r.total_orders) },
      ],
      "filtered-revenue-report",
    );
  const select = (
    key: keyof RevenueFilters,
    label: string,
    values: string[],
    empty: string,
  ) => (
    <SelectField
      label={label}
      value={filters[key] ?? ""}
      onChange={(v) => setFilters((f) => ({ ...f, [key]: v }))}
      options={[
        { value: "", label: empty },
        ...values.map((v) => ({
          value: v,
          label:
            key === "category"
              ? categoryName(v)
              : key === "region"
                ? regionName(v)
                : v,
        })),
      ]}
    />
  );
  return (
    <div className="manager-page">
      <PageHeading
        eyebrow={["OVERVIEW", "BUSINESS INTELLIGENCE"]}
        title="Manager Dashboard"
        description="A clear view of revenue, delivery performance, and customer satisfaction."
        actions={
          <>
            <span className="date-pill">
              <CalendarDays size={15} />
              {dateRange}
            </span>
            <button
              className="button secondary"
              disabled={revenueLoading || !!revenueError || !revenue.length}
              onClick={exportReport}
            >
              <ArrowDownToLine size={15} />
              Export report
            </button>
          </>
        }
      />
      {initialError && (
        <div className="notice error" role="alert">
          <Info size={16} />
          <span>Unable to load some overview data. {initialError}</span>
          <button
            className="button secondary"
            onClick={() => setInitialAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <section
        className="kpi-grid"
        aria-label="Full dataset key performance indicators"
      >
        {[
          {
            label: "Total revenue",
            value: kpi ? money(Number(kpi.total_revenue)) : "—",
            note: "Total product sales",
            icon: Wallet,
            color: "blue",
          },
          {
            label: "Total orders",
            value: kpi ? count(kpi.total_orders) : "—",
            note: "Across all purchase periods",
            icon: ShoppingBag,
            color: "violet",
          },
          {
            label: "Average order value",
            value: kpi ? money(Number(kpi.aov), 2) : "—",
            note: "Revenue per order",
            icon: Package,
            color: "cyan",
          },
          {
            label: "Average rating",
            value: kpi ? Number(kpi.avg_review_score).toFixed(2) : "—",
            suffix: "/ 5",
            note: "Customer review score",
            icon: Star,
            color: "amber",
          },
          {
            label: "Late delivery rate",
            value: kpi ? percent(kpi.late_delivery_rate) : "—",
            note: "Delivered after estimated date",
            icon: Truck,
            color: "rose",
          },
        ].map(({ label, value, suffix, note, icon: Icon, color }) => (
          <article className="kpi-card" key={label}>
            <div className="kpi-top">
              <span>{label}</span>
              <span className={`kpi-icon ${color}`}>
                <Icon size={18} />
              </span>
            </div>
            <div className="kpi-value">
              {value}
              {suffix && <span>{suffix}</span>}
            </div>
            <p>{note}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-section">
        <SectionHeading
          icon={BarChart3}
          title="Revenue over time & by region"
          aside={
            <>
              <Database size={13} />
              Product revenue · BRL
            </>
          }
        />
        <div className="surface">
          <div className="filter-bar">
            <div className="filters">
              {select(
                "year",
                "Year",
                uniq(allRevenue.map((r) => r.year)),
                "All years",
              )}
              {select(
                "category",
                "Category",
                uniq(allRevenue.map((r) => r.category)),
                "All categories",
              )}
              {select(
                "region",
                "Region",
                uniq(allRevenue.map((r) => r.region)),
                "All regions",
              )}
              <button className="clear-button" onClick={() => setFilters({})}>
                <RotateCcw size={14} />
                Clear filters
              </button>
            </div>
            <div className="filtered-total">
              <span>Filtered revenue</span>
              <strong>
                {revenueLoading
                  ? "Loading…"
                  : revenueError
                    ? "—"
                    : money(total)}
              </strong>
            </div>
          </div>
          <div className="filter-scope">
            <Info size={14} />
            <span>
              Filters apply to the revenue charts only. KPI cards reflect the
              full dataset.
            </span>
          </div>
          {revenueLoading ? (
            <DataState status="loading" />
          ) : revenueError ? (
            <DataState
              status="error"
              title="Unable to load revenue data"
              description={revenueError}
              retry={() => setRevenueAttempt((n) => n + 1)}
            />
          ) : !revenue.length ? (
            <DataState
              status="empty"
              title="No revenue matches the selected filters."
            />
          ) : (
            <>
              <div className="chart-panel">
                <PanelHeading
                  title="Revenue trend"
                  description="Monthly revenue by purchase date"
                  aside={
                    <ChartLegend
                      items={[{ label: "Revenue", color: "#2563eb" }]}
                    />
                  }
                />
                <div className="chart chart-revenue">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={months}
                      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#3b82f6"
                            stopOpacity={0.16}
                          />
                          <stop
                            offset="100%"
                            stopColor="#3b82f6"
                            stopOpacity={0.005}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 4" />
                      <XAxis
                        dataKey="label"
                        tickFormatter={monthLabel}
                        tick={axisStyle}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        tickFormatter={compactMoney}
                        tick={axisStyle}
                        tickLine={false}
                        axisLine={false}
                        width={76}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(v) => monthLabel(String(v))}
                        formatter={(v: number) => [money(v, 2), "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total_revenue"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#revenueFill)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-panel state-panel">
                <PanelHeading
                  title="Revenue by state"
                  description="Customer location, ranked by total revenue"
                  aside={
                    <span className="small-pill">{states.length} states</span>
                  }
                />
                <div className="chart chart-states">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={states}
                      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 4" />
                      <XAxis
                        dataKey="label"
                        tick={axisStyle}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={compactMoney}
                        tick={axisStyle}
                        tickLine={false}
                        axisLine={false}
                        width={76}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(v) => stateName(String(v))}
                        formatter={(v: number) => [money(v, 2), "Revenue"]}
                      />
                      <Bar
                        dataKey="total_revenue"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={37}
                        isAnimationActive={false}
                      >
                        {states.map((s, i) => (
                          <Cell
                            key={s.label}
                            fill={i === 0 ? "#2563eb" : "#6596f0"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-footnote">
                  Hover over a bar for the full state name.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
      <DeliverySection />
      <section className="dashboard-section products-section">
        <SectionHeading
          icon={Package}
          title="Product performance"
          aside="Full dataset"
        />
        <div className="surface table-panel">
          <PanelHeading
            title="10 lowest-revenue products"
            description="Products ranked by total revenue, from lowest to highest"
            aside={
              <span className="small-pill">
                {slowProducts?.length ?? 0} products
              </span>
            }
          />
          {slowProducts === null ? (
            <DataState
              status={initialError ? "error" : "loading"}
              title={initialError ? "Unable to load product data" : undefined}
            />
          ) : !slowProducts.length ? (
            <DataState status="empty" title="No product data available." />
          ) : (
            <DataTable
              rows={slowProducts}
              columns={productColumns}
              rowKey={(p) => p.product_id}
              label="Lowest-revenue products"
            />
          )}
          <TableFootnote>
            Product names are not available in this dataset. IDs are shortened
            for readability; hover over an ID for the full value.
          </TableFootnote>
        </div>
      </section>
    </div>
  );
}
