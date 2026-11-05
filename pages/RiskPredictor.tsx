import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Info,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import {
  api,
  type PredictInput,
  type PredictOptions,
  type PredictResult,
  type RiskModel,
  type RouteDistance,
} from "../api";
import {
  DataState,
  Notice,
  PageHeading,
  RiskBadge,
  SelectField,
} from "../components/Dashboard";
import { optionName, inputSourceName } from "../utils/format";
import { count, dateLabel, percent } from "../utils/display";
const FEATURES: Record<string, string> = {
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
  handoff_vs_limit_days: "Handoff delay past deadline (days)",
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
const INITIAL: OrderForm = {
  seller_state: "SP",
  customer_state: "RJ",
  category: "bed_bath_table",
  purchase_date: "2018-07-02",
  estimated_date: "2018-07-25",
  total_price: "",
  total_freight: "",
  n_items: "",
  payment_type: "",
};
const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));
const toDate = (v: string) => v || null;
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(days));
  return dateLabel(d.toISOString());
};
function ResultView({
  result,
  model,
}: {
  result: PredictResult;
  model: RiskModel;
}) {
  const color =
    result.risk_level === "High"
      ? "#db665a"
      : result.risk_level === "Medium"
        ? "#d79b31"
        : "#348b74";
  const history = result.route_history;
  const rate =
    history &&
    (model === "late_delivery" ? history.late_rate : history.low_review_rate);
  return (
    <div className="prediction-result" aria-live="polite">
      <div className="result-top">
        <strong style={{ color }}>{percent(result.risk_score)}</strong>
        <RiskBadge level={result.risk_level} />
      </div>
      <div
        className="risk-meter"
        aria-label={`Risk ${percent(result.risk_score)}`}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, result.risk_score * 100))}%`,
            background: color,
          }}
        />
        {[result.threshold / 2, result.threshold].map((t) => (
          <i key={t} style={{ left: `${t * 100}%` }} />
        ))}
      </div>
      <p className="threshold-caption">
        High at ≥ {percent(result.threshold)} · Medium at ≥{" "}
        {percent(result.threshold / 2)} (thresholds based on business costs).
      </p>
      {history && (
        <div className="route-history">
          <MapPin size={17} />
          <div>
            <strong>Route history</strong>
            <p>
              {count(history.orders)} orders · {percent(rate)}{" "}
              {model === "late_delivery"
                ? "late delivery rate"
                : "low rating rate"}
            </p>
          </div>
        </div>
      )}
      <details className="model-inputs">
        <summary>
          <ChevronDown size={14} />
          Model inputs ({result.inputs_used.length}{" "}
          {result.inputs_used.length === 1 ? "feature" : "features"})
        </summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Model input values"
        >
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Value</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.derived).map(([key, value]) => (
                <tr className="derived-row" key={`derived-${key}`}>
                  <td>{FEATURES[key] ?? key}</td>
                  <td>{value ?? "—"}</td>
                  <td>Calculated from dates</td>
                </tr>
              ))}
              {result.inputs_used.map((row) => (
                <tr
                  key={row.feature}
                  className={row.source === "nhập" ? "" : "default-row"}
                >
                  <td>{FEATURES[row.feature] ?? row.feature}</td>
                  <td>{row.value ?? "—"}</td>
                  <td>{inputSourceName(row.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          Muted rows show values supplied by the backend for fields left blank.
        </p>
      </details>
    </div>
  );
}
function ToolCard({
  model,
  order,
  extra,
  buildExtra,
  ready,
  resetKey,
}: {
  model: RiskModel;
  order: PredictInput | null;
  extra: ReactNode;
  buildExtra: () => Partial<PredictInput>;
  ready: boolean;
  resetKey: string;
}) {
  const [result, setResult] = useState<PredictResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const late = model === "late_delivery";
  useEffect(() => {
    generation.current++;
    setResult(null);
    setError(null);
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [resetKey]);
  const run = async () => {
    if (!order || !ready || busy) return;
    const request = ++generation.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const value = await api.predict(model, { ...order, ...buildExtra() });
      if (request === generation.current) setResult(value);
    } catch (e) {
      if (request === generation.current) setError(String(e));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  const Icon = late ? Truck : Star;
  return (
    <section className="surface predictor-card">
      <div className="predictor-card-heading">
        <span className={`kpi-icon ${late ? "blue" : "amber"}`}>
          <Icon size={20} />
        </span>
        <div>
          <h2>{late ? "Late delivery risk" : "Low rating risk (≤ 2 stars)"}</h2>
          <p>
            {late
              ? "Assess risk at carrier handoff and plan a follow-up."
              : "Assess risk after delivery, before the customer leaves a review."}
          </p>
        </div>
      </div>
      <div className="prediction-fields">{extra}</div>
      <button
        className="button primary"
        disabled={!ready || busy}
        onClick={run}
      >
        <ShieldCheck size={16} />
        {busy ? "Calculating…" : "Predict"}
      </button>
      {error && <Notice error>{error}</Notice>}
      {result ? (
        <ResultView result={result} model={model} />
      ) : (
        <div className="prediction-placeholder" role="status">
          <span className="state-icon">
            <ShieldCheck size={26} className={busy ? "spin" : ""} />
          </span>
          <h3>{busy ? "Requesting prediction…" : "Ready to predict"}</h3>
          <p>
            {busy
              ? "Waiting for the backend response."
              : "Review the order details, then select Predict to request a risk estimate."}
          </p>
        </div>
      )}
    </section>
  );
}
export default function RiskPredictor() {
  const [options, setOptions] = useState<PredictOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<OrderForm>(INITIAL);
  const [carrierDate, setCarrierDate] = useState("");
  const [limitDays, setLimitDays] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [distance, setDistance] = useState("");
  const [typical, setTypical] = useState<RouteDistance | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [routeAttempt, setRouteAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setError(null);
    api
      .predictOptions()
      .then((o) => {
        if (stale) return;
        setOptions(o);
        if (o.shipping_limit) setLimitDays(String(o.shipping_limit.days));
        setForm((f) => ({
          ...f,
          seller_state: o.seller_state.includes(f.seller_state)
            ? f.seller_state
            : (o.seller_state[0] ?? ""),
          customer_state: o.customer_state.includes(f.customer_state)
            ? f.customer_state
            : (o.customer_state[0] ?? ""),
          category: o.category.includes(f.category)
            ? f.category
            : (o.category[0] ?? ""),
        }));
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [attempt]);
  useEffect(() => {
    if (!options || !form.seller_state || !form.customer_state) return;
    let stale = false;
    setTypical(null);
    setDistance("");
    setRouteError(null);
    setDistanceLoading(true);
    api
      .routeDistance(form.seller_state, form.customer_state)
      .then((d) => {
        if (!stale) {
          setTypical(d);
          setDistance(String(d.distance_km));
        }
      })
      .catch((e) => {
        if (!stale) setRouteError(String(e));
      })
      .finally(() => {
        if (!stale) setDistanceLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [options, form.seller_state, form.customer_state, routeAttempt]);
  const update = (key: keyof OrderForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const policy = options?.shipping_limit;
  const limitEdited = !!policy && limitDays !== String(policy.days);
  const distanceEdited =
    distance !== "" && (!typical || distance !== String(typical.distance_km));
  const dateError =
    !!form.purchase_date &&
    !!form.estimated_date &&
    form.estimated_date < form.purchase_date;
  const numericError =
    [distance, form.total_price, form.total_freight, limitDays].some(
      (v) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0),
    ) ||
    (form.n_items !== "" &&
      (!Number.isInteger(Number(form.n_items)) || Number(form.n_items) < 1)) ||
    (limitDays !== "" && Number(limitDays) > 60);
  const ready =
    !!options &&
    !!form.seller_state &&
    !!form.customer_state &&
    !!form.category &&
    !!form.purchase_date &&
    !!form.estimated_date &&
    !dateError &&
    !numericError &&
    !distanceLoading;
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
  const resetKey = JSON.stringify([
    form,
    distance,
    carrierDate,
    deliveredDate,
    limitDays,
  ]);
  const select = (
    key: "seller_state" | "customer_state" | "category" | "payment_type",
    label: string,
    empty?: string,
  ) => (
    <SelectField
      label={label}
      value={form[key]}
      onChange={update(key)}
      options={[
        ...(empty ? [{ value: "", label: empty }] : []),
        ...(options?.[key] ?? []).map((v) => ({
          value: v,
          label: optionName(v),
        })),
      ]}
    />
  );
  const reset = () => {
    setForm(INITIAL);
    setCarrierDate("");
    setDeliveredDate("");
    setLimitDays(policy ? String(policy.days) : "");
    setDistance(typical ? String(typical.distance_km) : "");
  };
  return (
    <div className="predictor-page">
      <PageHeading
        eyebrow={["DECISION SUPPORT", "ORDER RISK EXPLORER"]}
        title="Predict risk for an order"
        description="Explore delivery risk and customer satisfaction using the trained model behind your API."
        actions={
          <button className="button secondary" onClick={reset}>
            <RotateCcw size={16} />
            Reset form
          </button>
        }
      />
      <div className="surface order-details">
        <div className="predictor-card-heading">
          <span className="kpi-icon blue">
            <Package size={21} />
          </span>
          <div>
            <h2>Order details</h2>
            <p>
              Shared by both risk cards. Blank optional fields use values
              supplied by the backend.
            </p>
          </div>
        </div>
        {!options ? (
          <DataState
            status={error ? "error" : "loading"}
            description={error ?? undefined}
            retry={error ? () => setAttempt((n) => n + 1) : undefined}
          />
        ) : (
          <>
            <div className="order-fields">
              {select("seller_state", "Seller state")}
              {select("customer_state", "Customer state")}
              <label className="form-field">
                Distance (km)
                <input
                  type="number"
                  aria-label="Distance (km)"
                  min={0}
                  step="any"
                  value={distance}
                  disabled={distanceLoading}
                  onChange={(e) => setDistance(e.target.value)}
                />
                <span className="field-hint">
                  {distanceLoading ? (
                    "Calculating…"
                  ) : distanceEdited ? (
                    <>
                      {"Edited · "}
                      {typical && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setDistance(String(typical.distance_km))
                          }
                          type="button"
                        >
                          restore {typical.distance_km} km
                        </button>
                      )}
                    </>
                  ) : typical?.source === "trung vị tuyến" ? (
                    `Median from ${count(typical.orders)} historical orders on this route`
                  ) : typical?.source === "tâm 2 bang" ? (
                    "Estimated from state centers"
                  ) : typical ? (
                    "Overall marketplace median"
                  ) : (
                    "Enter a distance, or leave blank for the backend default."
                  )}
                </span>
              </label>
              {select("category", "Category")}
              <label className="form-field">
                Purchase date
                <input
                  type="date"
                  aria-label="Purchase date"
                  value={form.purchase_date}
                  onChange={(e) => update("purchase_date")(e.target.value)}
                />
              </label>
              <label className="form-field">
                Estimated delivery date
                <input
                  type="date"
                  aria-label="Estimated delivery date"
                  value={form.estimated_date}
                  onChange={(e) => update("estimated_date")(e.target.value)}
                />
              </label>
            </div>
            {routeError && (
              <Notice error>
                Unable to load the default route distance.{" "}
                <button
                  className="text-button"
                  onClick={() => setRouteAttempt((n) => n + 1)}
                >
                  Try again
                </button>
              </Notice>
            )}
            <details className="optional-details">
              <summary>
                <ChevronDown size={14} />
                Optional details
              </summary>
              <div className="optional-fields">
                <label className="form-field">
                  Order value (R$)
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.total_price}
                    onChange={(e) => update("total_price")(e.target.value)}
                    placeholder="Backend default"
                  />
                </label>
                <label className="form-field">
                  Shipping cost (R$)
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.total_freight}
                    onChange={(e) => update("total_freight")(e.target.value)}
                    placeholder="Backend default"
                  />
                </label>
                <label className="form-field">
                  Number of items
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.n_items}
                    onChange={(e) => update("n_items")(e.target.value)}
                    placeholder="Backend default"
                  />
                </label>
                {select("payment_type", "Payment", "(most common)")}
              </div>
            </details>
          </>
        )}
      </div>
      {(dateError ||
        numericError ||
        (carrierDate && carrierDate < form.purchase_date) ||
        (deliveredDate && deliveredDate < form.purchase_date)) && (
        <Notice error>
          Check your inputs: dates must be on or after the purchase date;
          amounts and distance must be non-negative; the handoff deadline must
          be 0–60 days; the number of items must be a whole number of at least
          1.
        </Notice>
      )}
      <div className="prediction-grid">
        <ToolCard
          model="late_delivery"
          order={order}
          resetKey={resetKey}
          ready={ready && (!carrierDate || carrierDate >= form.purchase_date)}
          buildExtra={() => ({
            carrier_date: toDate(carrierDate),
            shipping_limit_days:
              limitDays.trim() !== "" && (!policy || limitEdited)
                ? toNumber(limitDays)
                : null,
          })}
          extra={
            <>
              <label className="form-field">
                Carrier handoff date
                <input
                  type="date"
                  aria-label="Carrier handoff date"
                  value={carrierDate}
                  onChange={(e) => setCarrierDate(e.target.value)}
                />
                <span className="field-hint">
                  Leave blank to use the backend default.
                </span>
              </label>
              <label className="form-field">
                Handoff deadline (days after purchase)
                <input
                  type="number"
                  aria-label="Handoff deadline (days after purchase)"
                  min={0}
                  max={60}
                  value={limitDays}
                  onChange={(e) => setLimitDays(e.target.value)}
                />
                <span className="field-hint">
                  {limitDays !== "" && form.purchase_date && !numericError && (
                    <>= {addDays(form.purchase_date, Number(limitDays))} · </>
                  )}
                  {limitEdited ? (
                    <button
                      className="text-button"
                      onClick={() => setLimitDays(String(policy?.days))}
                    >
                      restore {policy?.days} days
                    </button>
                  ) : policy?.source === "quy định sàn" ? (
                    "marketplace policy"
                  ) : policy ? (
                    "historical median"
                  ) : (
                    "Backend default"
                  )}
                </span>
              </label>
            </>
          }
        />
        <ToolCard
          model="low_review"
          order={order}
          resetKey={resetKey}
          ready={
            ready && (!deliveredDate || deliveredDate >= form.purchase_date)
          }
          buildExtra={() => ({ delivered_date: toDate(deliveredDate) })}
          extra={
            <label className="form-field">
              Actual delivery date
              <input
                type="date"
                aria-label="Actual delivery date"
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
              />
              <span className="field-hint">
                Leave blank to use the backend default.
              </span>
            </label>
          }
        />
      </div>
      <div className="predictor-note">
        <Info size={16} />
        <p>
          Changing any order input clears previous results. Blank optional
          values are sent as empty values, not implicit zeroes. Expand Model
          inputs after prediction to inspect the actual values and sources
          returned by the backend.
        </p>
      </div>
    </div>
  );
}
