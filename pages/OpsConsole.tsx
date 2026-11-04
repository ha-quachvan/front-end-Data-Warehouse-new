import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  api,
  Campaign,
  FeatureImportance,
  ModelMetrics,
  RiskModel,
  RiskSummaryRow,
  RiskyOrder,
  WhatIfResult,
} from "../api";
import { DownloadList, ExportColumn, RowLimit } from "../components/ListTools";

const th = { textAlign: "left" as const, borderBottom: "1px solid #ddd", padding: "4px 8px" };
const td = { padding: "4px 8px" };
const LEVELS = ["High", "Medium", "Low"];
const LEVEL_COLOR: Record<string, string> = { High: "#dc2626", Medium: "#d97706", Low: "#16a34a" };

const pct = (v: number | null) => (v === null ? "—" : `${(Number(v) * 100).toFixed(1)}%`);
const day = (ts: string | null) => (ts ? ts.slice(0, 10) : "—");
const num = (v: number | null, digits = 1) => (v === null ? "—" : Number(v).toFixed(digits));

function Level({ level }: { level: string }) {
  return <b style={{ color: LEVEL_COLOR[level] }}>{level}</b>;
}

// Bảng số đơn theo mức rủi ro; holdout có cột "xảy ra thật" để Ops tin được mức rủi ro
function RiskSummary({ rows, scope }: { rows: RiskSummaryRow[]; scope: string }) {
  const shown = rows.filter((r) => r.scope === scope);
  return (
    <p style={{ fontSize: 13 }}>
      {shown.map((r) => (
        <span key={r.risk_level} style={{ marginRight: 16 }}>
          <Level level={r.risk_level} />: {r.orders} đơn
          {r.actual_rate !== null && <> (thực tế xảy ra {pct(r.actual_rate)})</>}
        </span>
      ))}
    </p>
  );
}

// Thử dời ngày hẹn giao của đơn đang vận chuyển và xem rủi ro giao trễ còn bao nhiêu (gọi API what-if, không lưu vào DB)
function HandlingPanel({ order }: { order: RiskyOrder }) {
  const [extraDays, setExtraDays] = useState(5);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    api
      .whatIf("late_delivery", order.order_id, { estimated_days: order.estimated_days + extraDays })
      .then(setResult)
      .catch((e) => setError(String(e)));
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
      <b>Đề xuất xử lý cho đơn {order.order_id}</b>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", margin: "8px 0" }}>
        <label>
          Hẹn giao thêm{" "}
          <input type="number" value={extraDays} onChange={(e) => setExtraDays(Number(e.target.value))} style={{ width: 60 }} />{" "}
          ngày
        </label>
        <button onClick={run}>Xem rủi ro sau xử lý</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {result && (
        <p>
          Rủi ro: {pct(result.before.risk_score)} (<Level level={result.before.risk_level} />) →{" "}
          <b>{pct(result.after.risk_score)}</b> (<Level level={result.after.risk_level} />) · ngưỡng High = {pct(result.threshold)}
        </p>
      )}
    </div>
  );
}

// Xuất đủ giá trị (order_id đầy đủ) thay vì dạng rút gọn trên bảng
function orderColumns(isLate: boolean): ExportColumn<RiskyOrder>[] {
  return [
    { header: "order_id", value: (o) => o.order_id },
    { header: "Rủi ro (%)", value: (o) => Number((Number(o.risk_score) * 100).toFixed(1)) },
    { header: "Mức", value: (o) => o.risk_level },
    { header: "Bang người bán", value: (o) => o.seller_state },
    { header: "Bang khách", value: (o) => o.customer_state },
    { header: "Khoảng cách (km)", value: (o) => Math.round(o.distance_km) },
    { header: "Ngành", value: (o) => o.category },
    { header: "Ngày mua", value: (o) => o.purchase_ts?.slice(0, 10) ?? null },
    { header: "Ngày hẹn giao", value: (o) => o.estimated_date?.slice(0, 10) ?? null },
    isLate
      ? { header: "Bàn giao VC (ngày)", value: (o) => (o.carrier_days === null ? null : Number(o.carrier_days)) }
      : { header: "Trễ (ngày)", value: (o) => (o.delay_days === null ? null : Number(o.delay_days)) },
    // Đơn đang vận chuyển chưa có kết quả nên chỉ danh sách review thấp có cột này
    ...(isLate ? [] : [{ header: "Thực tế", value: reviewResult }]),
  ];
}

function reviewResult(o: RiskyOrder) {
  return o.actual_label === null ? "chưa biết" : `${o.review_score}★`;
}

function RiskyOrders({ model, title, note }: { model: RiskModel; title: string; note: string }) {
  const isLate = model === "late_delivery";
  // Giao trễ: đơn đang vận chuyển (còn can thiệp được). Review thấp: Olist không có đơn vừa giao chưa review nên mô phỏng trên tập kiểm định
  const scope = isLate ? "open" : "holdout";
  const [level, setLevel] = useState("High");
  const [limit, setLimit] = useState(50);
  const [summary, setSummary] = useState<RiskSummaryRow[] | null>(null);
  const [orders, setOrders] = useState<RiskyOrder[]>([]);
  const [selected, setSelected] = useState<RiskyOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.riskSummary(model).then(setSummary).catch(() => setSummary([]));
  }, [model]);

  useEffect(() => setSelected(null), [model, scope, level]);

  useEffect(() => {
    let stale = false; // bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc / số dòng
    api
      .riskyOrders(model, { scope, level, limit })
      .then((rows) => {
        if (!stale) setOrders(rows);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [model, scope, level, limit]);

  // Tổng số đơn theo bộ lọc đang chọn (level rỗng = tất cả mức); mức không có đơn nào thì không có dòng trong summary
  const total =
    summary === null
      ? null
      : summary
          .filter((r) => r.scope === scope && (level === "" || r.risk_level === level))
          .reduce((sum, r) => sum + Number(r.orders), 0);

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16 }}>{title}</h2>
      <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>{note}</p>
      {error && <p style={{ color: "crimson" }}>Không kết nối được backend-api: {error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Tất cả mức</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              Mức {l}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <RowLimit limit={limit} total={total} onChange={setLimit} />
          <DownloadList rows={orders} columns={orderColumns(isLate)} fileName={`${model}_${scope}_${level || "All"}_${orders.length}_dong`} />
        </span>
      </div>
      <RiskSummary rows={summary ?? []} scope={scope} />
      {isLate && selected && <HandlingPanel key={selected.order_id} order={selected} />}

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {[
              "order_id",
              "Rủi ro",
              "Tuyến",
              "Ngành",
              "Mua",
              "Hẹn giao",
              isLate ? "Bàn giao VC (ngày)" : "Trễ (ngày)",
              ...(isLate ? [""] : ["Thực tế"]),
            ].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_id} style={{ background: selected?.order_id === o.order_id ? "#eef2ff" : undefined }}>
              <td style={td}>{o.order_id.slice(0, 12)}…</td>
              <td style={td}>
                {pct(o.risk_score)} <Level level={o.risk_level} />
              </td>
              <td style={td}>
                {o.seller_state} → {o.customer_state} ({Math.round(o.distance_km)} km)
              </td>
              <td style={td}>{o.category}</td>
              <td style={td}>{day(o.purchase_ts)}</td>
              <td style={td}>{day(o.estimated_date)}</td>
              <td style={td}>{isLate ? num(o.carrier_days) : num(o.delay_days, 0)}</td>
              {!isLate && <td style={td}>{reviewResult(o)}</td>}
              {isLate && (
                <td style={td}>
                  <button onClick={() => setSelected(o)}>Đề xuất xử lý</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CampaignTargeting() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [code, setCode] = useState("");
  const [minRiskPct, setMinRiskPct] = useState("50");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .campaigns()
      .then((c) => {
        setCampaigns(c);
        // Không ghi đè lựa chọn nếu người dùng đã chọn trước khi dữ liệu tải xong
        setCode((current) => current || (c[0]?.campaign_code ?? ""));
      })
      .catch((e) => setMessage(String(e)));
  }, []);

  const riskPct = Number(minRiskPct);
  const validRisk = minRiskPct.trim() !== "" && riskPct >= 0 && riskPct <= 100;

  const assign = () => {
    setBusy(true);
    setMessage(null);
    api
      .assignRiskyCustomers(code, riskPct / 100)
      .then((r) => {
        const name = campaigns.find((c) => c.campaign_code === code)?.campaign_name;
        setMessage(
          r.inserted > 0
            ? `Đã gắn thêm ${r.inserted} khách vào "${name}".`
            : `Không có khách mới: mọi khách đạt ngưỡng đã có trong "${name}".`,
        );
      })
      .catch((e) => setMessage(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16 }}>Gắn khách vào campaign chăm sóc</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14 }}>
        <label htmlFor="min-risk">Gắn các khách hàng có rủi ro review thấp ≥</label>
        <span style={{ whiteSpace: "nowrap" }}>
          <input
            id="min-risk"
            type="number"
            min={0}
            max={100}
            step={5}
            value={minRiskPct}
            onChange={(e) => setMinRiskPct(e.target.value)}
            style={{ width: 64, padding: "4px 6px" }}
          />{" "}
          %
        </span>
        <label htmlFor="target-campaign">vào campaign</label>
        <select
          id="target-campaign"
          value={code}
          disabled={campaigns.length === 0}
          onChange={(e) => setCode(e.target.value)}
          style={{ padding: "4px 6px", maxWidth: "100%" }}
        >
          {campaigns.map((c) => (
            <option key={c.campaign_code} value={c.campaign_code}>
              {c.campaign_name}
            </option>
          ))}
        </select>
        <button disabled={!code || !validRisk || busy} onClick={assign}>
          Gắn khách
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0" }}>
        Đang mô phỏng trên các đơn thuộc tập kiểm định (đã có review thật). Khi triển khai, danh sách sẽ lấy từ các đơn vừa giao
        để chăm sóc trước khi khách đánh giá.
      </p>
      {campaigns.length === 0 && !message && (
        <p style={{ fontSize: 13 }}>
          Chưa có campaign. Tạo mới ở tab <a href="#/campaigns">Campaign</a>.
        </p>
      )}
      {message && (
        <p style={{ fontSize: 13 }}>
          {message} Xem danh sách ở tab <a href="#/campaigns">Campaign</a>.
        </p>
      )}
    </section>
  );
}

const MODEL_LABEL: Record<RiskModel, string> = { late_delivery: "Rủi ro giao trễ", low_review: "Rủi ro review thấp" };

function ModelQuality() {
  const [metrics, setMetrics] = useState<ModelMetrics[]>([]);
  const [importance, setImportance] = useState<Record<string, FeatureImportance[]>>({});
  const [validation, setValidation] = useState<Partial<Record<RiskModel, RiskSummaryRow[]>>>({});

  useEffect(() => {
    api.riskMetrics().then(setMetrics).catch(() => {});
    (["late_delivery", "low_review"] as RiskModel[]).forEach((m) => {
      api.featureImportance(m).then((rows) => setImportance((prev) => ({ ...prev, [m]: rows })));
      api
        .riskSummary(m)
        .then((rows) => setValidation((prev) => ({ ...prev, [m]: rows.filter((r) => r.scope === "holdout") })))
        .catch(() => {});
    });
  }, []);

  return (
    <section>
      <h2 style={{ fontSize: 16 }}>Chất lượng mô hình (tập kiểm định 06–08/2018)</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr>
            {["Mô hình", "Phiên bản", "Tỷ lệ dương", "ROC-AUC", "PR-AUC", "Ngưỡng", "Precision", "Recall", "F1", "Recall top 10%"].map(
              (h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={`${m.model_name}-${m.model_version}`} style={{ fontWeight: m.is_primary ? 600 : 400 }}>
              <td style={td}>{MODEL_LABEL[m.model_name]}</td>
              <td style={td}>{m.model_version}</td>
              <td style={td}>{pct(m.positive_rate)}</td>
              <td style={td}>{num(m.roc_auc, 3)}</td>
              <td style={td}>{num(m.pr_auc, 3)}</td>
              <td style={td}>{num(m.threshold, 2)}</td>
              <td style={td}>{pct(m.precision)}</td>
              <td style={td}>{pct(m.recall)}</td>
              <td style={td}>{num(m.f1, 3)}</td>
              <td style={td}>{pct(m.recall_top10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 14, marginBottom: 4 }}>Đối chiếu mức rủi ro với kết quả thật</h3>
      <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>
        Các đơn đã biết kết quả trong tập kiểm định: mức càng cao thì tỷ lệ xảy ra thật càng cao, nên có thể tin vào mức rủi ro của đơn chưa biết kết quả.
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr>
            {["Mô hình", "Mức", "Số đơn", "Tỷ lệ xảy ra thật"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["late_delivery", "low_review"] as RiskModel[]).flatMap((m) =>
            (validation[m] ?? []).map((r) => (
              <tr key={`${m}-${r.risk_level}`}>
                <td style={td}>{MODEL_LABEL[m]}</td>
                <td style={td}>
                  <Level level={r.risk_level} />
                </td>
                <td style={td}>{r.orders}</td>
                <td style={td}>
                  {pct(r.actual_rate)} {m === "late_delivery" ? "bị trễ" : "review ≤ 2 sao"}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {(["late_delivery", "low_review"] as RiskModel[]).map((m) => (
          <div key={m} style={{ flex: "1 1 420px" }}>
            <h3 style={{ fontSize: 14 }}>Feature quan trọng nhất — {MODEL_LABEL[m]}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={importance[m] ?? []} layout="vertical" margin={{ left: 40, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="feature" width={150} />
                <Tooltip formatter={(v: number) => [Number(v).toFixed(4), "Giảm PR-AUC"]} />
                <Bar dataKey="importance" fill="#2563eb" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function OpsConsole() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ops Console</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Vận hành & CSKH — đơn có rủi ro giao trễ, khách có rủi ro đánh giá thấp, campaign chăm sóc và chất lượng mô hình
      </p>
      <RiskyOrders
        model="late_delivery"
        title="Đơn đang vận chuyển có rủi ro giao trễ"
        note="Chấm điểm lúc đơn được bàn giao cho đơn vị vận chuyển. Hành động: liên hệ người bán/hãng vận chuyển, báo trước khách ngày giao mới."
      />
      <RiskyOrders
        model="low_review"
        title="Đơn vừa giao có rủi ro review thấp (≤ 2 sao)"
        note="Chấm điểm lúc đơn vừa giao tới khách, trước khi khách viết review. Hành động: gán vào campaign chăm sóc bên dưới."
      />
      <CampaignTargeting />
      <ModelQuality />
    </div>
  );
}
