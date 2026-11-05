import {
  categoryName,
  stateName,
  delayBucketName,
  regionName,
} from "../utils/format";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  DeliveryRoute,
  DeliveryTrendRow,
  KpiSummary,
  RevenueFilters,
  RevenueRow,
  ReviewByDelay,
  TopProduct,
} from "../api";

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="kpi-card"
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "16px 20px",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const brl = (v: number) =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
// Nhãn trục gọn: R$ 1,2 mi / R$ 300 mil
const brlCompact = (v: number) =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });

const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;

const cell = { padding: "4px 8px" };
const headCell = {
  textAlign: "left" as const,
  borderBottom: "1px solid #ddd",
  padding: "4px 8px",
};

// Cộng dồn total_revenue theo 1 khoá (tháng, bang, ...) rồi trả về mảng { label, total_revenue }
function sumBy(rows: RevenueRow[], key: (r: RevenueRow) => string) {
  return Object.values(
    rows.reduce<Record<string, { label: string; total_revenue: number }>>(
      (acc, r) => {
        const k = key(r);
        if (!acc[k]) acc[k] = { label: k, total_revenue: 0 };
        acc[k].total_revenue += Number(r.total_revenue);
        return acc;
      },
      {},
    ),
  );
}

const uniq = (values: (string | number | null)[]) =>
  [...new Set(values.filter((v) => v !== null).map(String))].sort();

// Hiệu suất giao hàng & mức độ hài lòng (câu hỏi nghiệp vụ 3) — đọc mv_delivery_performance + fact_order_fulfillment
function DeliverySection() {
  const [trend, setTrend] = useState<DeliveryTrendRow[]>([]);
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [byDelay, setByDelay] = useState<ReviewByDelay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.deliveryTrend(),
      api.deliveryRoutes(10),
      api.reviewByDelay(),
    ])
      .then(([t, r, d]) => {
        setTrend(
          t.map((row) => ({
            ...row,
            label: `${row.year}-${String(row.month).padStart(2, "0")}`,
          })),
        );
        setRoutes(r);
        setByDelay(d);
      })
      .catch(() =>
        setError(
          "Unable to load delivery data. Please check the backend connection.",
        ),
      );
  }, []);

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16 }}>Delivery & customer satisfaction</h2>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <h3 style={{ fontSize: 14 }}>
        Late delivery and low rating rates (≤ 2 stars) by purchase month
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trend} margin={{ right: 48 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Tooltip formatter={(v: number) => pct(v)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="late_rate"
            name="Late delivery"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="low_review_rate"
            name="Low ratings"
            stroke="#158678"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <h3 style={{ fontSize: 14 }}>Low ratings by delivery delay</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={byDelay} margin={{ right: 48 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tickFormatter={delayBucketName} />
          <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Tooltip
            labelFormatter={(value) => delayBucketName(String(value))}
            formatter={(v: number, name: string) => [pct(v), name]}
          />
          <Bar
            dataKey="low_review_rate"
            name="Low rating rate"
            fill="#158678"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <h3 style={{ fontSize: 14 }}>
        Top 10 routes by late delivery rate (seller → customer state, ≥ 200
        orders)
      </h3>
      <div className="table-scroll">
        <table
          style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}
        >
          <thead>
            <tr>
              {[
                "Route",
                "Orders",
                "Late delivery rate",
                "Avg. delivery days",
                "Avg. estimated days",
                "Low ratings",
              ].map((h) => (
                <th key={h} style={headCell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={`${r.seller_state}-${r.customer_state}`}>
                <td style={{ ...cell, minWidth: 220 }}>
                  {stateName(r.seller_state)} → {stateName(r.customer_state)}
                </td>
                <td style={cell}>{r.delivered_orders}</td>
                <td style={cell}>{pct(r.late_rate)}</td>
                <td style={cell}>{Number(r.avg_delivery_days).toFixed(1)}</td>
                <td style={cell}>{Number(r.avg_estimated_days).toFixed(1)}</td>
                <td style={cell}>{pct(r.low_review_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductTable({ rows }: { rows: TopProduct[] }) {
  return (
    <div className="table-scroll">
      <table
        style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}
      >
        <thead>
          <tr>
            {[
              "Product ID",
              "Category",
              "Revenue",
              "Quantity",
              "Orders",
              "Avg. rating",
            ].map((h) => (
              <th key={h} style={headCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.product_id}>
              <td style={cell}>
                <span title={p.product_id} className="record-id">
                  {p.product_id.slice(0, 12)}…
                </span>
              </td>
              <td style={cell}>{categoryName(p.category)}</td>
              <td style={cell}>{brl(Number(p.total_revenue))}</td>
              <td style={cell}>{p.total_quantity}</td>
              <td style={cell}>{p.total_orders}</td>
              <td style={cell}>
                {p.avg_review_score === null
                  ? "—"
                  : Number(p.avg_review_score).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManagerDashboard() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [allRevenue, setAllRevenue] = useState<RevenueRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RevenueFilters>({});
  const [slowProducts, setSlowProducts] = useState<TopProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.kpiSummary(),
      api.revenueTrend(),
      api.topProducts(10, true),
    ])
      .then(([k, r, s]) => {
        setKpi(k);
        setAllRevenue(r);
        setSlowProducts(s);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Slice/dice: mỗi lần đổi filter gọi lại API với year/category/region
  useEffect(() => {
    let stale = false;
    setRevenueLoading(true);
    setRevenueError(null);
    api
      .revenueTrend(filters)
      .then((rows) => {
        if (!stale) setRevenue(rows);
      })
      .catch(() => {
        if (!stale) {
          setRevenue([]);
          setRevenueError("Unable to load revenue. Please reload the page.");
        }
      })
      .finally(() => {
        if (!stale) setRevenueLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [filters]);

  const years = uniq(allRevenue.map((r) => r.year));
  const categories = uniq(allRevenue.map((r) => r.category));
  const regions = uniq(allRevenue.map((r) => r.region));

  const revenueByMonth = sumBy(
    revenue,
    (r) => `${r.year}-${String(r.month).padStart(2, "0")}`,
  ).sort((a, b) => a.label.localeCompare(b.label));
  const revenueByState = sumBy(revenue, (r) => r.state ?? "?").sort(
    (a, b) => b.total_revenue - a.total_revenue,
  );
  const filteredTotal = revenue.reduce(
    (sum, r) => sum + Number(r.total_revenue),
    0,
  );

  const filterSelect = (
    key: keyof RevenueFilters,
    label: string,
    options: string[],
  ) => (
    <label style={{ fontSize: 13 }}>
      {label}{" "}
      <select
        aria-label={label}
        value={filters[key] ?? ""}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {key === "category"
              ? categoryName(o)
              : key === "region"
                ? regionName(o)
                : o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Manager Dashboard</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Revenue, product performance and purchasing trends — Olist data (BRL)
      </p>

      {error && (
        <p style={{ color: "crimson" }}>Unable to load data: {error}</p>
      )}

      <div className="kpi-grid">
        <KpiCard
          label="Total revenue"
          value={kpi ? brl(kpi.total_revenue) : "—"}
        />
        <KpiCard
          label="Total orders"
          value={kpi ? kpi.total_orders.toLocaleString("en-US") : "—"}
        />
        <KpiCard label="Average order value" value={kpi ? brl(kpi.aov) : "—"} />
        <KpiCard
          label="Average rating"
          value={kpi ? kpi.avg_review_score.toFixed(2) + " / 5" : "—"}
        />
        <KpiCard
          label="Late delivery rate"
          value={kpi ? (kpi.late_delivery_rate * 100).toFixed(1) + "%" : "—"}
        />
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Revenue over time & by region</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          {filterSelect("year", "Year", years)}
          {filterSelect("category", "Category", categories)}
          {filterSelect("region", "Region", regions)}
          <button onClick={() => setFilters({})}>Clear filters</button>
          <span className="filtered-total">
            Filtered total:{" "}
            {revenueLoading
              ? "Loading…"
              : revenueError
                ? "—"
                : brl(filteredTotal)}
          </span>
        </div>

        {revenueError && (
          <p role="alert" className="notice error">
            {revenueError}
          </p>
        )}
        {!revenueLoading && !revenueError && revenue.length === 0 && (
          <p className="empty-state">
            No revenue matches the selected filters.
          </p>
        )}
        <p className="section-note">
          Filters apply to revenue over time, revenue by state and the filtered
          total. KPI cards show the full dataset.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueByMonth} margin={{ right: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis width={90} tickFormatter={brlCompact} />
            <Tooltip formatter={(v: number) => [brl(v), "Revenue"]} />
            <Line
              type="monotone"
              dataKey="total_revenue"
              stroke="#158678"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        <h3 style={{ fontSize: 14 }}>Revenue by state</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueByState} margin={{ right: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis width={90} tickFormatter={brlCompact} />
            <Tooltip
              labelFormatter={(label) => stateName(String(label))}
              formatter={(v: number) => [brl(v), "Revenue"]}
            />
            <Bar
              dataKey="total_revenue"
              fill="#158678"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <DeliverySection />

      <section>
        <h2 style={{ fontSize: 16 }}>10 lowest-revenue products</h2>
        <p className="section-note">
          Product names are not available in this dataset. Hover over an ID to
          see it in full.
        </p>
        {slowProducts.length === 0 ? (
          <p className="empty-state">No product data available.</p>
        ) : (
          <ProductTable rows={slowProducts} />
        )}
      </section>
    </div>
  );
}
