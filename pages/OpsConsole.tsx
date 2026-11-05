import { categoryName, stateName } from "../utils/format";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

const th = {
  textAlign: "left" as const,
  borderBottom: "1px solid #ddd",
  padding: "4px 8px",
};
const td = { padding: "4px 8px" };
const LEVELS = ["High", "Medium", "Low"];
const LEVEL_COLOR: Record<string, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#16a34a",
};

const pct = (v: number | null) =>
  v === null ? "—" : `${(Number(v) * 100).toFixed(1)}%`;
const day = (ts: string | null) => (ts ? ts.slice(0, 10) : "—");
const num = (v: number | null, digits = 1) =>
  v === null ? "—" : Number(v).toFixed(digits);

function Level({ level }: { level: string }) {
  return (
    <b
      className={`risk-badge risk-${level.toLowerCase()}`}
      style={{ color: LEVEL_COLOR[level] }}
    >
      {level}
    </b>
  );
}

// Bảng số đơn theo mức rủi ro; holdout có cột "xảy ra thật" để Ops tin được mức rủi ro
function RiskSummary({
  rows,
  scope,
}: {
  rows: RiskSummaryRow[];
  scope: string;
}) {
  const shown = rows.filter((r) => r.scope === scope);
  return (
    <p style={{ fontSize: 13 }}>
      {shown.map((r) => (
        <span key={r.risk_level} style={{ marginRight: 16 }}>
          <Level level={r.risk_level} />: {r.orders} orders
          {r.actual_rate !== null && <> (observed rate {pct(r.actual_rate)})</>}
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
      .whatIf("late_delivery", order.order_id, {
        estimated_days: order.estimated_days + extraDays,
      })
      .then(setResult)
      .catch((e) => setError(String(e)));
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      <b>Action simulation for order {order.order_id}</b>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          margin: "8px 0",
        }}
      >
        <label>
          Extend estimated delivery by{" "}
          <input
            type="number"
            min={0}
            max={365}
            value={extraDays}
            onChange={(e) => setExtraDays(Number(e.target.value))}
            style={{ width: 60 }}
          />{" "}
          days
        </label>
        <button
          disabled={
            !Number.isFinite(extraDays) || extraDays < 0 || extraDays > 365
          }
          onClick={run}
        >
          Simulate risk after action
        </button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {result && (
        <p>
          Risk: {pct(result.before.risk_score)} (
          <Level level={result.before.risk_level} />) →{" "}
          <b>{pct(result.after.risk_score)}</b> (
          <Level level={result.after.risk_level} />) · High threshold ={" "}
          {pct(result.threshold)}
        </p>
      )}
    </div>
  );
}

// Xuất đủ giá trị (order_id đầy đủ) thay vì dạng rút gọn trên bảng
function orderColumns(isLate: boolean): ExportColumn<RiskyOrder>[] {
  return [
    { header: "Order ID", value: (o) => o.order_id },
    {
      header: "Risk (%)",
      value: (o) => Number((Number(o.risk_score) * 100).toFixed(1)),
    },
    { header: "Risk level", value: (o) => o.risk_level },
    { header: "Seller state", value: (o) => stateName(o.seller_state) },
    { header: "Customer state", value: (o) => stateName(o.customer_state) },
    { header: "Distance (km)", value: (o) => Math.round(o.distance_km) },
    { header: "Category", value: (o) => categoryName(o.category) },
    {
      header: "Purchase date",
      value: (o) => o.purchase_ts?.slice(0, 10) ?? null,
    },
    {
      header: "Estimated delivery date",
      value: (o) => o.estimated_date?.slice(0, 10) ?? null,
    },
    isLate
      ? {
          header: "Carrier handoff (days)",
          value: (o) =>
            o.carrier_days === null ? null : Number(o.carrier_days),
        }
      : {
          header: "Delay (days)",
          value: (o) => (o.delay_days === null ? null : Number(o.delay_days)),
        },
    // Đơn đang vận chuyển chưa có kết quả nên chỉ danh sách review thấp có cột này
    ...(isLate ? [] : [{ header: "Actual outcome", value: reviewResult }]),
  ];
}

function reviewResult(o: RiskyOrder) {
  return o.actual_label === null ? "Unknown" : `${o.review_score}★`;
}

function RiskyOrders({
  model,
  title,
  note,
}: {
  model: RiskModel;
  title: string;
  note: string;
}) {
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
    api
      .riskSummary(model)
      .then(setSummary)
      .catch(() => setSummary([]));
  }, [model]);

  useEffect(() => setSelected(null), [model, scope, level]);

  useEffect(() => {
    let stale = false; // bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc / số dòng
    api
      .riskyOrders(model, { scope, level, limit })
      .then((rows) => {
        if (!stale) {
          setOrders(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (!stale) {
          setOrders([]);
          setError(String(e));
        }
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
          .filter(
            (r) =>
              r.scope === scope && (level === "" || r.risk_level === level),
          )
          .reduce((sum, r) => sum + Number(r.orders), 0);

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16 }}>{title}</h2>
      <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>{note}</p>
      {error && (
        <p style={{ color: "crimson" }}>Unable to load data: {error}</p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All risk levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              Risk level {l}
            </option>
          ))}
        </select>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <RowLimit limit={limit} total={total} onChange={setLimit} />
          <DownloadList
            rows={orders}
            columns={orderColumns(isLate)}
            fileName={`${model}_${scope}_${level || "All"}_${orders.length}_rows`}
          />
        </span>
      </div>
      <RiskSummary rows={summary ?? []} scope={scope} />
      {isLate && selected && (
        <HandlingPanel key={selected.order_id} order={selected} />
      )}

      <div className="table-scroll">
        <table
          style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}
        >
          <thead>
            <tr>
              {[
                "Order ID",
                "Risk",
                "Route",
                "Category",
                "Purchased",
                "Estimated delivery",
                isLate ? "Carrier handoff (days)" : "Delay (days)",
                ...(isLate ? [""] : ["Actual outcome"]),
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  {error
                    ? "Data is currently unavailable."
                    : "No orders match this selection."}
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.order_id}
                style={{
                  background:
                    selected?.order_id === o.order_id ? "#eef2ff" : undefined,
                }}
              >
                <td style={td} title={o.order_id} className="record-id">
                  {o.order_id.slice(0, 12)}…
                </td>
                <td style={td}>
                  {pct(o.risk_score)} <Level level={o.risk_level} />
                </td>
                <td style={td}>
                  {stateName(o.seller_state)} → {stateName(o.customer_state)} (
                  {Math.round(o.distance_km)} km)
                </td>
                <td style={td}>{categoryName(o.category)}</td>
                <td style={td}>{day(o.purchase_ts)}</td>
                <td style={td}>{day(o.estimated_date)}</td>
                <td style={td}>
                  {isLate ? num(o.carrier_days) : num(o.delay_days, 0)}
                </td>
                {!isLate && <td style={td}>{reviewResult(o)}</td>}
                {isLate && (
                  <td style={td}>
                    <button onClick={() => setSelected(o)}>
                      Simulate action
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        const name = campaigns.find(
          (c) => c.campaign_code === code,
        )?.campaign_name;
        setMessage(
          r.inserted > 0
            ? `Added ${r.inserted} ${r.inserted === 1 ? "customer" : "customers"} to "${name}".`
            : `No new customers: all eligible customers are already in "${name}".`,
        );
      })
      .catch((e) => setMessage(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16 }}>Assign customers to a care campaign</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
        }}
      >
        <label htmlFor="min-risk">
          Assign customers with low rating risk ≥
        </label>
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
        <label htmlFor="target-campaign">to campaign</label>
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
          Assign customers
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0" }}>
        This simulation uses validation orders with known ratings. In
        production, use newly delivered orders to provide care before customers
        leave a review.
      </p>
      {campaigns.length === 0 && !message && (
        <p style={{ fontSize: 13 }}>
          No campaigns yet. Create one in <a href="#/campaigns">Campaign</a>.
        </p>
      )}
      {message && (
        <p style={{ fontSize: 13 }}>
          {message} View the list in <a href="#/campaigns">Campaign</a>.
        </p>
      )}
    </section>
  );
}

const MODEL_LABEL: Record<RiskModel, string> = {
  late_delivery: "Late delivery risk",
  low_review: "Low rating risk",
};

function ModelQuality() {
  const [metrics, setMetrics] = useState<ModelMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importance, setImportance] = useState<
    Record<string, FeatureImportance[]>
  >({});
  const [validation, setValidation] = useState<
    Partial<Record<RiskModel, RiskSummaryRow[]>>
  >({});

  useEffect(() => {
    api
      .riskMetrics()
      .then(setMetrics)
      .catch(() => setError("Unable to load model quality data."));
    (["late_delivery", "low_review"] as RiskModel[]).forEach((m) => {
      api
        .featureImportance(m)
        .then((rows) => setImportance((prev) => ({ ...prev, [m]: rows })))
        .catch(() => setError("Unable to load model quality data."));
      api
        .riskSummary(m)
        .then((rows) =>
          setValidation((prev) => ({
            ...prev,
            [m]: rows.filter((r) => r.scope === "holdout"),
          })),
        )
        .catch(() => {});
    });
  }, []);

  return (
    <section>
      <h2 style={{ fontSize: 16 }}>
        Model quality (Jun–Aug 2018 validation set)
      </h2>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <thead>
            <tr>
              {[
                "Model",
                "Version",
                "Positive rate",
                "ROC-AUC",
                "PR-AUC",
                "Threshold",
                "Precision",
                "Recall",
                "F1",
                "Recall top 10%",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr
                key={`${m.model_name}-${m.model_version}`}
                style={{ fontWeight: m.is_primary ? 600 : 400 }}
              >
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
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 4 }}>
        Risk levels vs. observed outcomes
      </h3>
      <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>
        Compare risk levels with known outcomes in the validation set to assess
        how well the model identifies at-risk orders.
      </p>
      <div className="table-scroll">
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <thead>
            <tr>
              {["Model", "Risk level", "Orders", "Observed rate"].map((h) => (
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
                    {pct(r.actual_rate)}{" "}
                    {m === "late_delivery"
                      ? "late deliveries"
                      : "ratings ≤ 2 stars"}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {(["late_delivery", "low_review"] as RiskModel[]).map((m) => (
          <div key={m} style={{ flex: "1 1 420px" }}>
            <h3 style={{ fontSize: 14 }}>
              Most important features — {MODEL_LABEL[m]}
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={importance[m] ?? []}
                layout="vertical"
                margin={{ left: 40, right: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="feature" width={150} />
                <Tooltip
                  formatter={(v: number) => [
                    Number(v).toFixed(4),
                    "PR-AUC decrease",
                  ]}
                />
                <Bar
                  dataKey="importance"
                  fill="#2563eb"
                  isAnimationActive={false}
                />
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
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ops Console</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Operations & customer care — at-risk orders, low rating risk, care
        campaigns and model quality
      </p>
      <RiskyOrders
        model="late_delivery"
        title="In-transit orders at risk of late delivery"
        note="Scored when an order is handed to the carrier. Contact the seller or carrier and notify the customer of any revised delivery date."
      />
      <RiskyOrders
        model="low_review"
        title="Delivered orders at risk of low ratings (≤ 2 stars)"
        note="Scored after delivery, before the customer leaves a review. Assign at-risk customers to a care campaign below."
      />
      <CampaignTargeting />
      <ModelQuality />
    </div>
  );
}
