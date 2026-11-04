import { optionName } from "../utils/format";
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
  distance_km: "Khoảng cách người bán → khách (km)",
  estimated_days: "Số ngày hẹn giao",
  shipping_limit_days: "Hạn bàn giao (ngày sau khi mua)",
  approval_hours: "Thời gian duyệt đơn (giờ)",
  carrier_days: "Bàn giao vận chuyển (ngày sau khi mua)",
  actual_days: "Giao tới khách (ngày sau khi mua)",
  delay_days: "Trễ so với ngày hẹn (ngày)",
  n_items: "Số sản phẩm",
  total_price: "Giá trị đơn (R$)",
  total_freight: "Phí ship (R$)",
  total_weight_g: "Khối lượng (g)",
  total_volume_cm3: "Thể tích (cm³)",
  payment_installments: "Số kỳ trả góp",
  payment_type: "Hình thức thanh toán",
  slack_days: "Còn bao nhiêu ngày tới hạn giao khi bàn giao",
  handoff_vs_limit_days: "Bàn giao muộn so với hạn (ngày, > 0 là muộn)",
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
  return d.toLocaleDateString("vi-VN", {
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
          Mức {result.risk_level}
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
        High khi ≥ {pct(result.threshold)}, Medium khi ≥{" "}
        {pct(result.threshold / 2)} (ngưỡng theo chi phí nghiệp vụ).
      </p>
      {history && (
        <p style={{ fontSize: 13 }}>
          Lịch sử tuyến này: {history.orders.toLocaleString("vi-VN")} đơn,{" "}
          {model === "late_delivery"
            ? "tỷ lệ giao trễ"
            : "tỷ lệ review ≤ 2 sao"}{" "}
          <b>{pct(historyRate)}</b>.
        </p>
      )}
      <details>
        <summary style={{ fontSize: 13, cursor: "pointer" }}>
          Giá trị mô hình đã dùng ({result.inputs_used.length} đặc trưng)
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
                <th style={th}>Đặc trưng</th>
                <th style={th}>Giá trị</th>
                <th style={th}>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.derived).map(([f, v]) => (
                <tr key={f} style={{ background: "#eff6ff" }}>
                  <td style={td}>{FEATURE_LABEL[f] ?? f}</td>
                  <td style={td}>{v ?? "—"}</td>
                  <td style={td}>tính từ các ngày</td>
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
                    {r.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#666" }}>
          Dòng chữ xám = giá trị điển hình hệ thống tự điền vì bạn không nhập.
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
          {loading ? "Đang tính…" : "Dự đoán"}
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
        Dự đoán rủi ro cho một đơn
      </h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Nhập thông tin đơn hàng → mô hình đã train (HGB) trả về xác suất giao
        trễ / nhận review ≤ 2 sao. Thông tin không nhập sẽ được điền bằng giá
        trị điển hình của tuyến / ngành hàng.
      </p>
      {error && (
        <p style={{ color: "crimson" }}>
          Không kết nối được backend-api: {error}
        </p>
      )}

      <section style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Thông tin đơn</h2>
        {options && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <label style={label}>
                Bang người bán
                <Select
                  value={form.seller_state}
                  accessibleLabel="Bang người bán"
                  values={options.seller_state}
                  onChange={set("seller_state")}
                />
              </label>
              <label style={label}>
                Bang khách
                <Select
                  value={form.customer_state}
                  accessibleLabel="Bang khách"
                  values={options.customer_state}
                  onChange={set("customer_state")}
                />
              </label>
              <label style={label}>
                Khoảng cách (km)
                <input
                  type="number"
                  min={0}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 11, color: "#888", maxWidth: 170 }}>
                  {!typicalDistance ? (
                    "Đang tính…"
                  ) : distanceEdited ? (
                    <>
                      Bạn đã sửa ·{" "}
                      <a
                        href="#/predict"
                        onClick={(e) => {
                          e.preventDefault();
                          setDistance(String(typicalDistance.distance_km));
                        }}
                      >
                        dùng lại {typicalDistance.distance_km} km
                      </a>
                    </>
                  ) : typicalDistance.source === "trung vị tuyến" ? (
                    `Trung vị ${typicalDistance.orders.toLocaleString("vi-VN")} đơn thật của tuyến`
                  ) : typicalDistance.source === "tâm 2 bang" ? (
                    "Ước tính từ tâm 2 bang (tuyến ít đơn)"
                  ) : (
                    "Trung vị toàn sàn"
                  )}
                </span>
              </label>
              <label style={label}>
                Ngành hàng
                <Select
                  value={form.category}
                  accessibleLabel="Ngành hàng"
                  values={options.category}
                  onChange={set("category")}
                />
              </label>
              <label style={label}>
                Ngày mua
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set("purchase_date")(e.target.value)}
                />
              </label>
              <label style={label}>
                Ngày hẹn giao
                <input
                  type="date"
                  value={form.estimated_date}
                  onChange={(e) => set("estimated_date")(e.target.value)}
                />
              </label>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, cursor: "pointer" }}>
                Thông tin thêm (tuỳ chọn)
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
                  Giá trị đơn (R$)
                  <input
                    type="number"
                    min={0}
                    value={form.total_price}
                    onChange={(e) => set("total_price")(e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
                <label style={label}>
                  Phí ship (R$)
                  <input
                    type="number"
                    min={0}
                    value={form.total_freight}
                    onChange={(e) => set("total_freight")(e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
                <label style={label}>
                  Số sản phẩm
                  <input
                    type="number"
                    min={1}
                    value={form.n_items}
                    onChange={(e) => set("n_items")(e.target.value)}
                    style={{ width: 80 }}
                  />
                </label>
                <label style={label}>
                  Thanh toán
                  <Select
                    value={form.payment_type}
                    accessibleLabel="Thanh toán"
                    values={options.payment_type}
                    onChange={set("payment_type")}
                    empty="(phổ biến nhất)"
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
          Kiểm tra thông tin: các ngày phải từ ngày mua trở đi; số tiền, khoảng
          cách và hạn bàn giao không âm; số sản phẩm là số nguyên ít nhất 1.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <ToolCard
          model="late_delivery"
          title="Rủi ro giao trễ"
          note="Thời điểm dùng: khi người bán vừa bàn giao cho đơn vị vận chuyển. Rủi ro cao → liên hệ người bán/hãng vận chuyển, báo trước khách."
          order={order}
          resetKey={resetKey}
          ready={lateReady}
          extra={
            <>
              <label style={label}>
                Ngày bàn giao vận chuyển
                <input
                  type="date"
                  value={carrierDate}
                  onChange={(e) => setCarrierDate(e.target.value)}
                />
              </label>
              <label style={label}>
                Hạn bàn giao (ngày sau khi mua)
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
                      đã sửa ·{" "}
                      <a
                        href="#/predict"
                        onClick={(e) => {
                          e.preventDefault();
                          setLimitDays(String(policy.days));
                        }}
                      >
                        dùng lại {policy.days} ngày
                      </a>
                    </>
                  ) : policy.source === "quy định sàn" ? (
                    "theo quy định sàn"
                  ) : (
                    "mặc định = trung vị dữ liệu thật"
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
          title="Rủi ro nhận review thấp (≤ 2 sao)"
          note="Thời điểm dùng: khi đơn vừa giao tới khách, trước khi khách đánh giá. Rủi ro cao → voucher / gọi hỏi thăm."
          order={order}
          resetKey={resetKey}
          ready={reviewReady}
          extra={
            <label style={label}>
              Ngày giao tới khách
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
        Ô ngày để trống → dùng số ngày điển hình của tuyến (vd. ngày giao tới
        khách = ngày mua + số ngày giao trung vị của tuyến). Mở "Giá trị mô hình
        đã dùng" để xem chi tiết.
      </p>
    </div>
  );
}
