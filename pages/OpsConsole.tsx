import { useEffect, useRef, useState } from "react";
import { Check, SlidersHorizontal, Star, Users, X } from "lucide-react";
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
  type Campaign,
  type FeatureImportance,
  type ModelMetrics,
  type RiskModel,
  type RiskSummaryRow,
  type RiskyOrder,
  type WhatIfResult,
} from "../api";
import {
  DataState,
  DataTable,
  Notice,
  PageHeading,
  PanelHeading,
  RecordId,
  RiskBadge,
  SectionHeading,
  SelectField,
  TableFootnote,
  type Column,
} from "../components/Dashboard";
import {
  DownloadList,
  RowLimit,
  type ExportColumn,
} from "../components/ListTools";
import { categoryName, stateName } from "../utils/format";
import {
  axisStyle,
  count,
  dateLabel,
  featureName,
  percent,
  tooltipStyle,
} from "../utils/display";
const MODELS: RiskModel[] = ["late_delivery", "low_review"];
const MODEL_LABEL: Record<RiskModel, string> = {
  late_delivery: "Late delivery risk",
  low_review: "Low rating risk",
};
const reviewResult = (o: RiskyOrder) =>
  o.review_score === null ? "Unknown" : `${o.review_score} / 5`;
function orderColumns(late: boolean): ExportColumn<RiskyOrder>[] {
  return [
    { header: "Order ID", value: (o) => o.order_id },
    {
      header: "Risk (%)",
      value: (o) => Number((o.risk_score * 100).toFixed(1)),
    },
    { header: "Risk level", value: (o) => o.risk_level },
    { header: "Seller state", value: (o) => stateName(o.seller_state) },
    { header: "Customer state", value: (o) => stateName(o.customer_state) },
    { header: "Distance (km)", value: (o) => o.distance_km },
    { header: "Category", value: (o) => categoryName(o.category) },
    {
      header: "Purchase date",
      value: (o) => o.purchase_ts?.slice(0, 10) ?? null,
    },
    {
      header: "Estimated delivery date",
      value: (o) => o.estimated_date?.slice(0, 10) ?? null,
    },
    late
      ? { header: "Carrier handoff (days)", value: (o) => o.carrier_days }
      : { header: "Delay (days)", value: (o) => o.delay_days },
    ...(late ? [] : [{ header: "Actual outcome", value: reviewResult }]),
  ];
}
function HandlingPanel({
  order,
  onClose,
}: {
  order: RiskyOrder;
  onClose: () => void;
}) {
  const [extraDays, setExtraDays] = useState("5");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid =
    extraDays.trim() !== "" &&
    Number.isFinite(Number(extraDays)) &&
    Number(extraDays) >= 0 &&
    Number(extraDays) <= 365;
  const run = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api.whatIf("late_delivery", order.order_id, {
          estimated_days: Number(order.estimated_days) + Number(extraDays),
        }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="handling-panel">
      <div className="handling-title">
        <div>
          <h3>
            Action simulation for order <RecordId value={order.order_id} />
          </h3>
          <p>
            Explore a revised delivery estimate. This simulation does not update
            the order.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close action simulation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="inline-form">
        <label className="form-field">
          Extend estimated delivery by
          <span className="unit-input">
            <input
              type="number"
              aria-label="Extend estimated delivery by"
              min={0}
              max={365}
              value={extraDays}
              disabled={busy}
              onChange={(e) => {
                setExtraDays(e.target.value);
                setResult(null);
              }}
            />
            <span>days</span>
          </span>
        </label>
        <button
          className="button primary"
          onClick={run}
          disabled={!valid || busy}
        >
          <SlidersHorizontal size={14} />
          {busy ? "Calculating…" : "Simulate risk after action"}
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {result && (
        <div className="what-if-result">
          <div>
            <span>Current risk</span>
            <strong>{percent(result.before.risk_score)}</strong>
            <RiskBadge level={result.before.risk_level} />
          </div>
          <span className="result-arrow">→</span>
          <div>
            <span>After action</span>
            <strong>{percent(result.after.risk_score)}</strong>
            <RiskBadge level={result.after.risk_level} />
          </div>
          <p>
            High threshold: {percent(result.threshold)} · Based on the backend
            what-if response.
          </p>
        </div>
      )}
    </div>
  );
}
function RiskyOrders({ model }: { model: RiskModel }) {
  const late = model === "late_delivery",
    scope = late ? "open" : "holdout";
  const [level, setLevel] = useState("");
  const [limit, setLimit] = useState(50);
  const [summary, setSummary] = useState<RiskSummaryRow[] | null>(null);
  const [orders, setOrders] = useState<RiskyOrder[]>([]);
  const [selected, setSelected] = useState<RiskyOrder | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setSummaryError(false);
    api
      .riskSummary(model)
      .then((rows) => {
        if (!stale) setSummary(rows);
      })
      .catch(() => {
        if (!stale) setSummaryError(true);
      });
    return () => {
      stale = true;
    };
  }, [model, attempt]);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    api
      .riskyOrders(model, { scope, level, limit })
      .then((rows) => {
        if (!stale) setOrders(rows);
      })
      .catch((e) => {
        if (!stale) {
          setOrders([]);
          setError(String(e));
        }
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [model, scope, level, limit, attempt]);
  const shownSummary = summary?.filter((r) => r.scope === scope) ?? [];
  const total =
    summary && !summaryError
      ? shownSummary
          .filter((r) => !level || r.risk_level === level)
          .reduce((sum, r) => sum + Number(r.orders), 0)
      : null;
  const columns: Column<RiskyOrder>[] = [
    {
      key: "id",
      label: "Order ID",
      value: (o) => o.order_id,
      render: (o) => <RecordId value={o.order_id} />,
    },
    {
      key: "risk",
      label: "Risk",
      value: (o) => Number(o.risk_score),
      render: (o) => (
        <span className="risk-cell">
          <strong>{percent(o.risk_score)}</strong>
          <RiskBadge level={o.risk_level} />
        </span>
      ),
    },
    {
      key: "route",
      label: "Route & distance",
      value: (o) => `${o.seller_state}-${o.customer_state}`,
      render: (o) => (
        <div className="route-cell">
          <span
            title={`${stateName(o.seller_state)} → ${stateName(o.customer_state)}`}
          >
            {o.seller_state ?? "—"}
            <span className="route-arrow">→</span>
            {o.customer_state ?? "—"}
          </span>
          <small>{count(Math.round(o.distance_km))} km</small>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      value: (o) => o.category,
      render: (o) => (
        <span className="category-tag">{categoryName(o.category)}</span>
      ),
    },
    {
      key: "purchased",
      label: "Purchased",
      value: (o) => o.purchase_ts,
      render: (o) => dateLabel(o.purchase_ts),
    },
    {
      key: "estimated",
      label: "Est. delivery",
      value: (o) => o.estimated_date,
      render: (o) => dateLabel(o.estimated_date),
    },
    {
      key: "duration",
      label: late ? "Carrier handoff" : "Delivery delay",
      value: (o) => (late ? o.carrier_days : o.delay_days),
      render: (o) => (
        <span className={!late && (o.delay_days ?? 0) > 0 ? "delay-value" : ""}>
          {(late ? o.carrier_days : o.delay_days) === null
            ? "—"
            : `${Number(late ? o.carrier_days : o.delay_days).toFixed(late ? 1 : 0)} days`}
        </span>
      ),
    },
    late
      ? {
          key: "action",
          label: "Action",
          value: (o) => o.order_id,
          sortable: false,
          render: (o) => (
            <button
              className="button secondary small"
              aria-expanded={selected?.order_id === o.order_id}
              onClick={(event) => {
                selectedButton.current = event.currentTarget;
                setSelected((current) =>
                  current?.order_id === o.order_id ? null : o,
                );
              }}
            >
              <SlidersHorizontal size={13} />
              Simulate action
            </button>
          ),
        }
      : {
          key: "observed",
          label: "Observed rating",
          value: (o) => o.review_score,
          render: (o) =>
            o.review_score === null ? (
              "Unknown"
            ) : (
              <span className="rating-cell">
                <Star size={13} fill="#f5b84b" color="#f5b84b" />
                {reviewResult(o)}
              </span>
            ),
        },
  ];
  return (
    <section className="dashboard-section risk-orders">
      <SectionHeading
        title={
          late
            ? "In-transit orders at risk of late delivery"
            : "Delivered orders at risk of low ratings (≤ 2 stars)"
        }
        aside={late ? "Scored at carrier handoff" : "Low rating = 1 or 2 stars"}
      />
      <p className="section-description">
        {late
          ? "Prioritize carrier follow-ups and explore changes to the estimated delivery window."
          : "Identify customers who may need a care follow-up after delivery, before they leave a review."}
      </p>
      <div className="surface">
        <div className="table-toolbar">
          <div className="risk-filters">
            <SelectField
              label={
                late ? "Late-delivery risk level" : "Low-rating risk level"
              }
              value={level}
              onChange={setLevel}
              options={[
                { value: "", label: "All risk levels" },
                ...["High", "Medium", "Low"].map((v) => ({
                  value: v,
                  label: `Risk level ${v}`,
                })),
              ]}
            />
            <div className="risk-summary">
              {shownSummary.map((r) => (
                <span
                  key={r.risk_level}
                  title={
                    r.actual_rate === null
                      ? undefined
                      : `Observed rate: ${percent(r.actual_rate)}`
                  }
                >
                  <RiskBadge level={r.risk_level} />
                  <b>{count(r.orders)}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="list-tools">
            <RowLimit limit={limit} total={total} onChange={setLimit} />
            <DownloadList
              rows={loading ? [] : orders}
              columns={orderColumns(late)}
              fileName={`${model}_${scope}_${level || "All"}_${orders.length}_rows`}
            />
          </div>
        </div>
        {summaryError && (
          <Notice error>
            Unable to load risk counts.{" "}
            <button
              className="text-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </Notice>
        )}
        {loading ? (
          <DataState status="loading" />
        ) : error ? (
          <DataState
            status="error"
            description={error}
            retry={() => setAttempt((n) => n + 1)}
          />
        ) : !orders.length ? (
          <DataState status="empty" title="No orders match this selection." />
        ) : (
          <DataTable
            rows={orders}
            columns={columns}
            rowKey={(o) => o.order_id}
            label={late ? "Late-delivery orders" : "Low-rating orders"}
            rowClassName={(o) =>
              o.order_id === selected?.order_id ? "selected-row" : ""
            }
            expandedRow={(o) =>
              o.order_id === selected?.order_id && (
                <HandlingPanel
                  order={o}
                  onClose={() => {
                    setSelected(null);
                    selectedButton.current?.focus();
                  }}
                />
              )
            }
          />
        )}
        <div className="list-footer">
          <span>
            Showing <strong>{loading ? "…" : orders.length}</strong>
            {total !== null ? ` of ${count(total)}` : ""} matching orders
          </span>
          <span>
            {late
              ? "Open orders · Delivery outcome not yet known"
              : "Historical validation orders · Observed ratings shown for context"}
          </span>
        </div>
        <TableFootnote>
          Downloads include the displayed rows, complete order IDs, original
          dates and readable category/state labels.
        </TableFootnote>
      </div>
    </section>
  );
}
function CampaignTargeting() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [code, setCode] = useState("");
  const [risk, setRisk] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setError(null);
    api
      .campaigns()
      .then((c) => {
        if (!stale) {
          setCampaigns(c);
          setCode((current) => current || c[0]?.campaign_code || "");
        }
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [attempt]);
  const valid =
    risk.trim() !== "" &&
    Number.isFinite(Number(risk)) &&
    Number(risk) >= 0 &&
    Number(risk) <= 100;
  const assign = async () => {
    if (busy || !valid || !code) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await api.assignRiskyCustomers(code, Number(risk) / 100);
      const name = campaigns?.find(
        (c) => c.campaign_code === code,
      )?.campaign_name;
      setMessage(
        r.inserted > 0
          ? `Added ${r.inserted} ${r.inserted === 1 ? "customer" : "customers"} to "${name}".`
          : `No new customers: all eligible customers are already in "${name}".`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="dashboard-section">
      <SectionHeading title="Assign customers to a care campaign" />
      <div className="surface targeting-panel">
        <PanelHeading
          title="Turn a risk signal into a care follow-up"
          description="Assign customers above the selected risk threshold. Each assignment is handled by the backend."
        />
        {campaigns === null && !error ? (
          <DataState status="loading" />
        ) : (
          <div className="inline-form">
            <label className="form-field">
              Minimum low-rating risk
              <span className="unit-input">
                <input
                  aria-label="Minimum low-rating risk"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={risk}
                  disabled={busy}
                  onChange={(e) => setRisk(e.target.value)}
                />
                <span>%</span>
              </span>
            </label>
            <SelectField
              label="Care campaign"
              value={code}
              onChange={setCode}
              disabled={busy || !campaigns?.length}
              options={(campaigns ?? []).map((c) => ({
                value: c.campaign_code,
                label: c.campaign_name,
              }))}
            />
            <button
              className="button primary"
              disabled={!code || !valid || busy}
              onClick={assign}
            >
              {busy ? <span className="spinner-dot" /> : <Users size={16} />}
              Assign customers
            </button>
          </div>
        )}
        {error && (
          <Notice error>
            {error}{" "}
            <button
              className="text-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Reload campaigns
            </button>
          </Notice>
        )}
        {message && (
          <Notice>
            <Check size={14} />
            {message} View the list in <a href="#/campaigns">Campaign</a>.
          </Notice>
        )}
        {campaigns?.length === 0 && (
          <Notice>
            No campaigns yet. Create one in <a href="#/campaigns">Campaign</a>.
          </Notice>
        )}
        <div className="panel-note">
          Customer assignment uses historical validation orders in this project.
          It does not send messages to customers.
        </div>
      </div>
    </section>
  );
}
function ModelQuality() {
  const [data, setData] = useState<{
    metrics: ModelMetrics[];
    importance: FeatureImportance[][];
    validation: RiskSummaryRow[][];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setError(null);
    setData(null);
    Promise.all([
      api.riskMetrics(),
      Promise.all(MODELS.map((m) => api.featureImportance(m))),
      Promise.all(MODELS.map((m) => api.riskSummary(m))),
    ])
      .then(([metrics, importance, validation]) => {
        if (!stale) setData({ metrics, importance, validation });
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [attempt]);
  const metricColumns: Column<ModelMetrics>[] = [
    {
      key: "name",
      label: "Model",
      value: (m) => m.model_name,
      render: (m) => MODEL_LABEL[m.model_name],
    },
    { key: "version", label: "Version", value: (m) => m.model_version },
    {
      key: "positive",
      label: "Positive rate",
      value: (m) => m.positive_rate,
      numeric: true,
      render: (m) => percent(m.positive_rate),
    },
    ...[
      "roc_auc",
      "pr_auc",
      "threshold",
      "precision",
      "recall",
      "f1",
      "recall_top10",
    ].map((key) => ({
      key,
      label: (
        {
          roc_auc: "ROC-AUC",
          pr_auc: "PR-AUC",
          threshold: "Threshold",
          precision: "Precision",
          recall: "Recall",
          f1: "F1 score",
          recall_top10: "Top 10% recall",
        } as Record<string, string>
      )[key],
      numeric: true,
      value: (m: ModelMetrics) => Number(m[key as keyof ModelMetrics]),
      render: (m: ModelMetrics) =>
        ["precision", "recall", "recall_top10", "threshold"].includes(key)
          ? percent(Number(m[key as keyof ModelMetrics]))
          : Number(m[key as keyof ModelMetrics]).toFixed(3),
    })),
  ];
  const validation =
    data?.validation.flatMap((rows, i) =>
      rows
        .filter((r) => r.scope === "holdout")
        .map((r) => ({ ...r, model: MODELS[i] })),
    ) ?? [];
  return (
    <section className="dashboard-section">
      <SectionHeading
        title="Model quality & validation results"
        aside="Jun–Aug 2018 validation set"
      />
      {!data ? (
        <div className="surface">
          <DataState
            status={error ? "error" : "loading"}
            description={error ?? undefined}
            retry={error ? () => setAttempt((n) => n + 1) : undefined}
          />
        </div>
      ) : (
        <div className="surface quality-group">
          <div className="table-panel">
            <PanelHeading
              title="Validation metrics"
              description="Metrics returned by the backend for each model version"
            />
            {data.metrics.length ? (
              <DataTable
                rows={data.metrics}
                columns={metricColumns}
                rowKey={(m) => `${m.model_name}-${m.model_version}`}
                label="Model metrics"
              />
            ) : (
              <DataState status="empty" title="No model metrics available" />
            )}
          </div>
          <div className="table-panel">
            <PanelHeading
              title="Observed outcomes by risk level"
              description="Known outcomes in the validation set, grouped by model and risk level"
            />
            <DataTable
              rows={validation}
              rowKey={(r) => `${r.model}-${r.risk_level}`}
              label="Observed outcomes"
              columns={[
                {
                  key: "model",
                  label: "Outcome",
                  value: (r) => r.model,
                  render: (r) => MODEL_LABEL[r.model],
                },
                {
                  key: "level",
                  label: "Risk level",
                  value: (r) => r.risk_level,
                  render: (r) => <RiskBadge level={r.risk_level} />,
                },
                {
                  key: "orders",
                  label: "Sample orders",
                  numeric: true,
                  value: (r) => Number(r.orders),
                  render: (r) => count(r.orders),
                },
                {
                  key: "actual",
                  label: "Observed rate",
                  numeric: true,
                  value: (r) => r.actual_rate,
                  render: (r) => percent(r.actual_rate),
                },
              ]}
            />
          </div>
          <div className="feature-grid">
            {MODELS.map((m, i) => (
              <div className="chart-panel" key={m}>
                <PanelHeading
                  title={`${MODEL_LABEL[m]} feature importance`}
                  description="Change in PR-AUC when a feature is permuted"
                />
                {data.importance[i].length ? (
                  <div className="feature-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.importance[i]}
                        layout="vertical"
                        margin={{ left: 0, right: 20 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="3 4"
                        />
                        <XAxis
                          type="number"
                          tick={axisStyle}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="feature"
                          tickFormatter={featureName}
                          width={140}
                          tick={axisStyle}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number) => [
                            Number(v).toFixed(4),
                            "PR-AUC decrease",
                          ]}
                        />
                        <Bar
                          dataKey="importance"
                          maxBarSize={20}
                          radius={[0, 4, 4, 0]}
                          fill={i === 0 ? "#3974ec" : "#8290e9"}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <DataState status="empty" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
export default function OpsConsole() {
  return (
    <div className="ops-page">
      <PageHeading
        title="Ops Console"
        sourceDescription="Risk queues, model metrics and simulations are returned by the configured backend. Simulations do not save changes to orders. Campaign assignments are saved through the campaign API."
      />
      <RiskyOrders model="late_delivery" />
      <RiskyOrders model="low_review" />
      <CampaignTargeting />
      <ModelQuality />
    </div>
  );
}
