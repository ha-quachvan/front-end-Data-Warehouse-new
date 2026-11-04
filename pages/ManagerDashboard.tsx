import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "16px 20px", minWidth: 180 }}>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// Nhãn trục gọn: R$ 1,2 mi / R$ 300 mil
const brlCompact = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;

const cell = { padding: "4px 8px" };
const headCell = { textAlign: "left" as const, borderBottom: "1px solid #ddd", padding: "4px 8px" };

// Cộng dồn total_revenue theo 1 khoá (tháng, bang, ...) rồi trả về mảng { label, total_revenue }
function sumBy(rows: RevenueRow[], key: (r: RevenueRow) => string) {
  return Object.values(
    rows.reduce<Record<string, { label: string; total_revenue: number }>>((acc, r) => {
      const k = key(r);
      if (!acc[k]) acc[k] = { label: k, total_revenue: 0 };
      acc[k].total_revenue += Number(r.total_revenue);
      return acc;
    }, {}),
  );
}

const uniq = (values: (string | number | null)[]) =>
  [...new Set(values.filter((v) => v !== null).map(String))].sort();

// Hiệu suất giao hàng & mức độ hài lòng (câu hỏi nghiệp vụ 3) — đọc mv_delivery_performance + fact_order_fulfillment
function DeliverySection() {
  const [trend, setTrend] = useState<DeliveryTrendRow[]>([]);
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [byDelay, setByDelay] = useState<ReviewByDelay[]>([]);

  useEffect(() => {
    Promise.all([api.deliveryTrend(), api.deliveryRoutes(10), api.reviewByDelay()]).then(([t, r, d]) => {
      setTrend(t.map((row) => ({ ...row, label: `${row.year}-${String(row.month).padStart(2, "0")}` })));
      setRoutes(r);
      setByDelay(d);
    });
  }, []);

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16 }}>Giao hàng và mức độ hài lòng</h2>
      <h3 style={{ fontSize: 14 }}>Tỷ lệ giao trễ và tỷ lệ review thấp (≤ 2 sao) theo tháng mua</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={trend} margin={{ right: 48 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Tooltip formatter={(v: number) => pct(v)} />
          <Legend />
          <Line type="monotone" dataKey="late_rate" name="Giao trễ" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="low_review_rate" name="Review thấp" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <h3 style={{ fontSize: 14 }}>Review theo mức trễ so với ngày hẹn</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={byDelay} margin={{ right: 48 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" />
          <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Tooltip formatter={(v: number, name: string) => [pct(v), name]} />
          <Bar dataKey="low_review_rate" name="Tỷ lệ review thấp" fill="#2563eb" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>

      <h3 style={{ fontSize: 14 }}>10 tuyến giao trễ nhiều nhất (bang người bán → bang khách, ≥ 200 đơn)</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {["Tuyến", "Số đơn", "Tỷ lệ trễ", "Ngày giao TB", "Ngày hẹn TB", "Review thấp"].map((h) => (
              <th key={h} style={headCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={`${r.seller_state}-${r.customer_state}`}>
              <td style={cell}>
                {r.seller_state} → {r.customer_state}
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
    </section>
  );
}

function ProductTable({ rows }: { rows: TopProduct[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
      <thead>
        <tr>
          {["product_id", "Ngành", "Doanh thu", "Số lượng", "Số đơn", "Review TB"].map((h) => (
            <th key={h} style={headCell}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.product_id}>
            <td style={cell}>{p.product_id}</td>
            <td style={cell}>{p.category}</td>
            <td style={cell}>{brl(Number(p.total_revenue))}</td>
            <td style={cell}>{p.total_quantity}</td>
            <td style={cell}>{p.total_orders}</td>
            <td style={cell}>{p.avg_review_score === null ? "—" : Number(p.avg_review_score).toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ManagerDashboard() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [allRevenue, setAllRevenue] = useState<RevenueRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [filters, setFilters] = useState<RevenueFilters>({});
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [slowProducts, setSlowProducts] = useState<TopProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.kpiSummary(), api.revenueTrend(), api.topProducts(10), api.topProducts(10, true)])
      .then(([k, r, t, s]) => {
        setKpi(k);
        setAllRevenue(r);
        setTopProducts(t);
        setSlowProducts(s);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Slice/dice: mỗi lần đổi filter gọi lại API với year/category/region
  useEffect(() => {
    api.revenueTrend(filters).then(setRevenue).catch((e) => setError(String(e)));
  }, [filters]);

  const years = uniq(allRevenue.map((r) => r.year));
  const categories = uniq(allRevenue.map((r) => r.category));
  const regions = uniq(allRevenue.map((r) => r.region));

  const revenueByMonth = sumBy(revenue, (r) => `${r.year}-${String(r.month).padStart(2, "0")}`).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const revenueByState = sumBy(revenue, (r) => r.state ?? "?").sort((a, b) => b.total_revenue - a.total_revenue);
  const filteredTotal = revenue.reduce((sum, r) => sum + Number(r.total_revenue), 0);

  const topProductRows = topProducts.map((p) => ({ ...p, label: `${p.category} · ${p.product_id.slice(0, 6)}` }));

  const filterSelect = (key: keyof RevenueFilters, label: string, options: string[]) => (
    <label style={{ fontSize: 13 }}>
      {label}{" "}
      <select value={filters[key] ?? ""} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
        <option value="">Tất cả</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Manager Dashboard</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Doanh thu, hiệu suất sản phẩm và xu hướng mua sắm — dữ liệu Olist (BRL)</p>

      {error && <p style={{ color: "crimson" }}>Không kết nối được backend-api: {error}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <KpiCard label="Tổng doanh thu" value={kpi ? brl(kpi.total_revenue) : "—"} />
        <KpiCard label="Tổng số đơn" value={kpi ? kpi.total_orders.toLocaleString("vi-VN") : "—"} />
        <KpiCard label="AOV (giá trị đơn TB)" value={kpi ? brl(kpi.aov) : "—"} />
        <KpiCard label="Điểm review TB" value={kpi ? kpi.avg_review_score.toFixed(2) + " / 5" : "—"} />
        <KpiCard label="Tỷ lệ giao trễ" value={kpi ? (kpi.late_delivery_rate * 100).toFixed(1) + "%" : "—"} />
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Doanh thu theo thời gian và khu vực</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 12 }}>
          {filterSelect("year", "Năm", years)}
          {filterSelect("category", "Ngành", categories)}
          {filterSelect("region", "Vùng", regions)}
          <button onClick={() => setFilters({})}>Bỏ lọc</button>
          <span style={{ fontSize: 13, color: "#666" }}>Tổng theo bộ lọc: {brl(filteredTotal)}</span>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueByMonth} margin={{ right: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis width={90} tickFormatter={brlCompact} />
            <Tooltip formatter={(v: number) => [brl(v), "Doanh thu"]} />
            <Line type="monotone" dataKey="total_revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>

        <h3 style={{ fontSize: 14 }}>Doanh thu theo bang</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueByState} margin={{ right: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis width={90} tickFormatter={brlCompact} />
            <Tooltip formatter={(v: number) => [brl(v), "Doanh thu"]} />
            <Bar dataKey="total_revenue" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Top 10 sản phẩm theo doanh thu</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={topProductRows} layout="vertical" margin={{ left: 80, right: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={brlCompact} />
            <YAxis type="category" dataKey="label" width={200} />
            <Tooltip formatter={(v: number) => [brl(v), "Doanh thu"]} />
            <Bar dataKey="total_revenue" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <DeliverySection />

      <section>
        <h2 style={{ fontSize: 16 }}>10 sản phẩm bán chậm nhất (doanh thu thấp nhất)</h2>
        <ProductTable rows={slowProducts} />
      </section>
    </div>
  );
}
