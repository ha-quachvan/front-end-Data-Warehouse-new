import { optionName, inputSourceName } from "../utils/format";
import { useEffect, useRef, useState } from "react";
import {
  api,
  PredictInput,
  PredictOptions,
  PredictResult,
  RiskModel,
  RouteDistance,
} from "../api";

const LEVEL_COLOR: Record<string, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#16a34a",
};
const pct = (v: number | null) =>
  v === null ? "—" : `${(Number(v) * 100).toFixed(1)}%`;
const card = { border: "1px solid #ddd", borderRadius: 8, padding: 16 };
const label = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  fontSize: 13,
};
const th = {
  textAlign: "left" as const,
  borderBottom: "1px solid #ddd",
  padding: "4px 8px",
};
const td = { padding: "4px 8px" };

// Tên dễ hiểu cho các đặc trưng trả về trong inputs_used / derived
const FEATURE_LABEL: Record<string, string> = {
  distance_km: "Seller → customer distance (km)",
  estimated_days: "Estimated delivery time (days)",
  shipping_limit_days: "Handoff deadline (days after purchase)",
  approval_hours: "Order approval time (hours)",
  carrier_days: "Carrier handoff (days after purchase)",
  actual_days: "Delivery (days after purchase)",
  delay_days: "Delay past estimated delivery (days)",
  n_items: "Number of items",
  total_price: "Order value (R$)",
  total_freight: "Shipping cost (R$)",
  total_weight_g: "Weight (g)",
  total_volume_cm3: "Volume (cm³)",
  payment_installments: "Payment installments",
  payment_type: "Payment method",
  slack_days: "Days until estimated delivery at handoff",
  handoff_vs_limit_days: "Handoff delay past deadline (days; > 0 means late)",
};

type OrderForm = {
  seller_state: string;
  customer_state: string;
  category: string;
  purchase_date: string;
  estimated_date: string;
  total_price: string;
  total_freight: string;
  n_items: string;
  payment_type: string;
};

const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));
const toDate = (v: string) => (v === "" ? null : v);
// "2018-07-02" + 6.5 ngày -> "08/07/2018" (bỏ phần lẻ giờ, giống cách ETL tính theo ngày)
const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + Math.floor(days));
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function Select({
  value,
  values,
  onChange,
  empty,
  accessibleLabel,
}: {
  value: string;
  values: string[];
  onChange: (v: string) => void;
  empty?: string;
  accessibleLabel: string;
}) {
  return (
    <select
      aria-label={accessibleLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {empty !== undefined && <option value="">{empty}</option>}
      {values.map((v) => (
        <option key={v} value={v}>
          {optionName(v)}
        </option>
      ))}
    </select>
  );
}

function ResultView({
  result,
  model,
}: {
  result: PredictResult;
  model: RiskModel;
}) {
  const color = LEVEL_COLOR[result.risk_level];
  const history = result.route_history;
  const historyRate =
    history &&
    (model === "late_delivery" ? history.late_rate : history.low_review_rate);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color }}>
          {pct(result.risk_score)}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color }}>
          Risk level {result.risk_level}
        </span>
      </div>
      {/* Thanh rủi ro: vạch đứt = ngưỡng Medium (t/2) và High (t) */}
      <div
        style={{
          position: "relative",
          height: 10,
          background: "#f3f4f6",
          borderRadius: 5,
          margin: "8px 0 4px",
        }}
      >
        <div
          style={{
            width: `${result.risk_score * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 5,
          }}
        />
        {[result.threshold / 2, result.threshold].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              top: -3,
              height: 16,
              borderLeft: "2px dashed #6b7280",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
        High at ≥ {pct(result.threshold)}, Medium at ≥{" "}
        {pct(result.threshold / 2)} (thresholds based on business costs).
      </p>
      {history && (
        <p style={{ fontSize: 13 }}>
          Route history: {history.orders.toLocaleString("en-US")} orders,{" "}
          {model === "late_delivery"
            ? "late delivery rate"
            : "rate of ratings ≤ 2 stars"}{" "}
          <b>{pct(historyRate)}</b>.
        </p>
      )}
      <details>
        <summary style={{ fontSize: 13, cursor: "pointer" }}>
          Model inputs ({result.inputs_used.length} features)
        </summary>
        <div className="table-scroll">
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: 12,
              marginTop: 6,
            }}
          >
            <thead>
              <tr>
                <th style={th}>Feature</th>
                <th style={th}>Value</th>
                <th style={th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.derived).map(([f, v]) => (
                <tr key={f} style={{ background: "#eff6ff" }}>
                  <td style={td}>{FEATURE_LABEL[f] ?? f}</td>
                  <td style={td}>{v ?? "—"}</td>
                  <td style={td}>Calculated from dates</td>
                </tr>
              ))}
              {result.inputs_used.map((r) => (
                <tr
                  key={r.feature}
                  style={{ color: r.source === "nhập" ? "#111" : "#6b7280" }}
                >
                  <td style={td}>{FEATURE_LABEL[r.feature] ?? r.feature}</td>
                  <td style={td}>{r.value ?? "—"}</td>
                  <td
                    style={{
                      ...td,
                      fontStyle: r.source === "nhập" ? "normal" : "italic",
                    }}
                  >
                    {inputSourceName(r.source)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#666" }}>
          Gray rows are typical values filled in automatically for fields left
          blank.
        </p>
      </details>
    </div>
  );
}

function ToolCard({
  model,
  title,
  note,
  order,
  extra,
  buildExtra,
  ready,
  resetKey,
}: {
  model: RiskModel;
  title: string;
  note: string;
  order: PredictInput | null;
  extra: React.ReactNode;
  buildExtra: () => Partial<PredictInput>;
  ready: boolean;
  resetKey: string;
}) {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  }, [resetKey]);
  const run = () => {
    if (!order || !ready) return;
    const request = ++generation.current;
    setError(null);
    setLoading(true);
    api
      .predict(model, { ...order, ...buildExtra() })
      .then((value) => {
        if (request === generation.current) setResult(value);
      })
      .catch((e) => {
        if (request === generation.current) {
          setResult(null);
          setError(String(e));
        }
      })
      .finally(() => {
        if (request === generation.current) setLoading(false);
      });
  };

  return (
    <div style={{ ...card, flex: "1 1 440px" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ fontSize: 12, color: "#888", marginTop: 0 }}>{note}</p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        {extra}
        <button
          onClick={run}
          disabled={!ready || loading}
          style={{ padding: "6px 16px" }}
        >
          {loading ? "Calculating…" : "Predict"}
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
      {result && <ResultView result={result} model={model} />}
    </div>
  );
}

export default function RiskPredictor() {
  const [options, setOptions] = useState<PredictOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OrderForm>({
    seller_state: "SP",
    customer_state: "RJ",
    category: "bed_bath_table",
    purchase_date: "2018-07-02",
    estimated_date: "2018-07-25",
    total_price: "",
    total_freight: "",
    n_items: "",
    payment_type: "",
  });
  const [carrierDate, setCarrierDate] = useState("");
  // Hạn bàn giao = ngày mua + N ngày; N lấy sẵn theo quy định sàn, sửa được
  const [limitDays, setLimitDays] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  // Khoảng cách: tự điền theo tuyến mỗi khi đổi bang; người dùng sửa tay thì gửi giá trị đã sửa
  const [typicalDistance, setTypicalDistance] = useState<RouteDistance | null>(
    null,
  );
  const [distance, setDistance] = useState("");
  const distanceEdited =
    typicalDistance !== null &&
    distance !== String(typicalDistance.distance_km);

  useEffect(() => {
    api
      .predictOptions()
      .then((o) => {
        setOptions(o);
        if (o.shipping_limit) setLimitDays(String(o.shipping_limit.days));
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!options) return;
    let stale = false;
    setTypicalDistance(null);
    api
      .routeDistance(form.seller_state, form.customer_state)
      .then((d) => {
        if (stale) return;
        setTypicalDistance(d);
        setDistance(String(d.distance_km));
      })
      .catch((e) => setError(String(e)));
    return () => {
      stale = true;
    };
  }, [options, form.seller_state, form.customer_state]);

  const policy = options?.shipping_limit;
  const limitEdited = !!policy && limitDays !== String(policy.days);

  const set = (field: keyof OrderForm) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  const dateError =
    !!form.purchase_date &&
    !!form.estimated_date &&
    form.estimated_date < form.purchase_date;
  const numericError =
    [distance, form.total_price, form.total_freight, limitDays].some(
      (v) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0),
    ) ||
    (form.n_items !== "" &&
      (!Number.isInteger(Number(form.n_items)) || Number(form.n_items) < 1));
  const ready =
    !!options &&
    !!form.purchase_date &&
    !!form.estimated_date &&
    !dateError &&
    !numericError;
  const lateReady =
    ready && (!carrierDate || carrierDate >= form.purchase_date);
  const reviewReady =
    ready && (!deliveredDate || deliveredDate >= form.purchase_date);
  const resetKey = JSON.stringify([
    form,
    distance,
    carrierDate,
    deliveredDate,
    limitDays,
  ]);
  const order: PredictInput | null = ready
    ? {
        seller_state: form.seller_state,
        customer_state: form.customer_state,
        category: form.category,
        purchase_date: form.purchase_date,
        estimated_date: form.estimated_date,
        total_price: toNumber(form.total_price),
        total_freight: toNumber(form.total_freight),
        n_items: toNumber(form.n_items),
        payment_type: form.payment_type || null,
        distance_km: distanceEdited ? toNumber(distance) : null,
      }
    : null;

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>
        Predict risk for an order
      </h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Enter order details to estimate the probability of late delivery or a
        rating of 2 stars or less using the trained HGB model. Blank fields use
        typical values for the route or category.
      </p>
      {error && (
        <p style={{ color: "crimson" }}>Unable to load data: {error}</p>
      )}

      <section style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Order details</h2>
        {options && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <label style={label}>
                Seller state
                <Select
                  value={form.seller_state}
                  accessibleLabel="Seller state"
                  values={options.seller_state}
                  onChange={set("seller_state")}
                />
              </label>
              <label style={label}>
                Customer state
                <Select
                  value={form.customer_state}
                  accessibleLabel="Customer state"
                  values={options.customer_state}
                  onChange={set("customer_state")}
                />
              </label>
              <label style={label}>
                Distance (km)
                <input
                  type="number"
                  min={0}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 11, color: "#888", maxWidth: 170 }}>
                  {!typicalDistance ? (
                    "Calculating…"
                  ) : distanceEdited ? (
                    <>
                      Edited ·{" "}
                      <a
                        href="#/predict"
                        onClick={(e) => {
                          e.preventDefault();
                          setDistance(String(typicalDistance.distance_km));
                        }}
                      >
                        restore {typicalDistance.distance_km} km
                      </a>
                    </>
                  ) : typicalDistance.source === "trung vị tuyến" ? (
                    `Median from ${typicalDistance.orders.toLocaleString("en-US")} historical orders on this route`
                  ) : typicalDistance.source === "tâm 2 bang" ? (
                    "Estimated from state centers (limited route history)"
                  ) : (
                    "Overall marketplace median"
                  )}
                </span>
              </label>
              <label style={label}>
                Category
                <Select
                  value={form.category}
                  accessibleLabel="Category"
                  values={options.category}
                  onChange={set("category")}
                />
              </label>
              <label style={label}>
                Purchase date
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set("purchase_date")(e.target.value)}
                />
              </label>
              <label style={label}>
                Estimated delivery date
                <input
                  type="date"
                  value={form.estimated_date}
                  onChange={(e) => set("estimated_date")(e.target.value)}
                />
              </label>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, cursor: "pointer" }}>
                Additional details (optional)
              </summary>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  marginTop: 8,
                }}
              >
                <label style={label}>
                  Order value (R$)
                  <input
                    type="number"
                    min={0}
                    value={form.total_price}
                    onChange={(e) => set("total_price")(e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
                <label style={label}>
                  Shipping cost (R$)
                  <input
                    type="number"
                    min={0}
                    value={form.total_freight}
                    onChange={(e) => set("total_freight")(e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
                <label style={label}>
                  Number of items
                  <input
                    type="number"
                    min={1}
                    value={form.n_items}
                    onChange={(e) => set("n_items")(e.target.value)}
                    style={{ width: 80 }}
                  />
                </label>
                <label style={label}>
                  Payment
                  <Select
                    value={form.payment_type}
                    accessibleLabel="Payment"
                    values={options.payment_type}
                    onChange={set("payment_type")}
                    empty="(most common)"
                  />
                </label>
              </div>
            </details>
          </>
        )}
      </section>

      {(dateError ||
        numericError ||
        (carrierDate && carrierDate < form.purchase_date) ||
        (deliveredDate && deliveredDate < form.purchase_date)) && (
        <p role="alert" className="notice error">
          Check your inputs: dates must be on or after the purchase date;
          amounts, distance and the handoff deadline must be non-negative; the
          number of items must be a whole number of at least 1.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <ToolCard
          model="late_delivery"
          title="Late delivery risk"
          note="Use when the seller hands the order to the carrier. If risk is high, contact the seller or carrier and notify the customer."
          order={order}
          resetKey={resetKey}
          ready={lateReady}
          extra={
            <>
              <label style={label}>
                Carrier handoff date
                <input
                  type="date"
                  value={carrierDate}
                  onChange={(e) => setCarrierDate(e.target.value)}
                />
              </label>
              <label style={label}>
                Handoff deadline (days after purchase)
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={limitDays}
                  onChange={(e) => setLimitDays(e.target.value)}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 11, color: "#888", maxWidth: 190 }}>
                  {limitDays !== "" && form.purchase_date !== "" && (
                    <>= {addDays(form.purchase_date, Number(limitDays))} · </>
                  )}
                  {!policy ? (
                    ""
                  ) : limitEdited ? (
                    <>
                      edited ·{" "}
                      <a
                        href="#/predict"
                        onClick={(e) => {
                          e.preventDefault();
                          setLimitDays(String(policy.days));
                        }}
                      >
                        restore {policy.days} days
                      </a>
                    </>
                  ) : policy.source === "quy định sàn" ? (
                    "marketplace policy"
                  ) : (
                    "default: historical median"
                  )}
                </span>
              </label>
            </>
          }
          buildExtra={() => ({
            carrier_date: toDate(carrierDate),
            shipping_limit_days: limitEdited ? toNumber(limitDays) : null,
          })}
        />
        <ToolCard
          model="low_review"
          title="Low rating risk (≤ 2 stars)"
          note="Use just after delivery, before the customer leaves a review. If risk is high, consider a voucher or a care call."
          order={order}
          resetKey={resetKey}
          ready={reviewReady}
          extra={
            <label style={label}>
              Actual delivery date
              <input
                type="date"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
              />
            </label>
          }
          buildExtra={() => ({ delivered_date: toDate(deliveredDate) })}
        />
      </div>
      <p style={{ fontSize: 12, color: "#888" }}>
        Blank dates use typical delivery times for the route (for example,
        delivery date = purchase date + median route delivery days). Expand
        "Model inputs" to see the values used.
      </p>
    </div>
  );
}
