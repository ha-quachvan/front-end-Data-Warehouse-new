const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// ---------- Manager dashboard ----------

export type RevenueRow = {
  year: number;
  month: number;
  category: string;
  region: string | null;
  state: string | null;
  total_revenue: number;
  total_quantity: number;
  total_orders: number;
};

// Olist không có tên sản phẩm -> hiển thị bằng category + product_id
export type TopProduct = {
  product_id: string;
  category: string;
  total_revenue: number;
  total_quantity: number;
  total_orders: number;
  avg_review_score: number | null;
};

export type KpiSummary = {
  total_revenue: number;
  total_orders: number;
  aov: number;
  avg_review_score: number;
  late_delivery_rate: number;
};

export type DeliveryTrendRow = {
  year: number;
  month: number;
  delivered_orders: number;
  late_rate: number;
  avg_delivery_days: number;
  avg_review_score: number;
  low_review_rate: number;
};

export type DeliveryRoute = {
  seller_state: string;
  customer_state: string;
  delivered_orders: number;
  late_rate: number;
  avg_delivery_days: number;
  avg_estimated_days: number;
  low_review_rate: number;
};

export type ReviewByDelay = {
  bucket: string;
  orders: number;
  avg_review_score: number;
  low_review_rate: number;
};

// ---------- Ops console (DSS: rủi ro giao trễ / review thấp) ----------

export type RiskModel = "late_delivery" | "low_review";

export type RiskSummaryRow = {
  scope: "holdout" | "open";
  risk_level: "High" | "Medium" | "Low";
  orders: number;
  avg_score: number;
  actual_rate: number | null;
};

export type RiskyOrder = {
  order_id: string;
  risk_score: number;
  risk_level: string;
  actual_label: boolean | null;
  order_status: string;
  purchase_ts: string;
  carrier_ts: string | null;
  delivered_ts: string | null;
  estimated_date: string;
  seller_state: string | null;
  customer_state: string | null;
  category: string | null;
  distance_km: number;
  estimated_days: number;
  carrier_days: number | null;
  delay_days: number | null;
  total_price: number;
  review_score: number | null;
};

export type ModelMetrics = {
  model_name: RiskModel;
  model_version: string;
  is_primary: boolean;
  n_train: number;
  n_test: number;
  positive_rate: number;
  roc_auc: number;
  pr_auc: number;
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  threshold_valid: number;
  f1_valid_threshold: number;
  precision_top10: number;
  recall_top10: number;
};

export type FeatureImportance = { feature: string; importance: number };

export type WhatIfState = { risk_score: number; risk_level: string } & Record<
  string,
  number | string | null
>;
export type WhatIfResult = {
  order_id: string;
  model: RiskModel;
  threshold: number;
  before: WhatIfState;
  after: WhatIfState;
};

export type Campaign = {
  campaign_code: string;
  campaign_name: string;
  description: string | null;
  total_targets: number;
};

export type CampaignTargets = {
  campaign_code: string;
  total: number;
  avg_risk: number | null;
  customers: {
    customer_id: string;
    city: string;
    state: string;
    order_id: string;
    risk_score: number;
    assigned_at: string;
  }[];
};

// ---------- Công cụ dự đoán rủi ro cho đơn giả định ----------

export type PredictOptions = {
  customer_state: string[];
  seller_state: string[];
  category: string[];
  payment_type: string[];
  // Hạn bàn giao mặc định (ngày sau khi mua): quy định sàn (DEFAULT_SHIPPING_LIMIT_DAYS) hoặc trung vị dữ liệu
  shipping_limit?: { days: number; source: string };
};

export type PredictInput = {
  seller_state: string;
  customer_state: string;
  category: string;
  purchase_date: string;
  estimated_date: string;
  carrier_date?: string | null;
  shipping_limit_date?: string | null;
  shipping_limit_days?: number | null;
  delivered_date?: string | null;
  distance_km?: number | null;
  total_price?: number | null;
  total_freight?: number | null;
  n_items?: number | null;
  payment_type?: string | null;
};

export type RouteDistance = {
  seller_state: string;
  customer_state: string;
  distance_km: number;
  source: string;
  orders: number;
};

export type PredictResult = {
  model: RiskModel;
  risk_score: number;
  risk_level: "High" | "Medium" | "Low";
  threshold: number;
  inputs_used: {
    feature: string;
    value: number | string | null;
    source: string;
  }[];
  derived: Record<string, number | null>;
  route_history: {
    orders: number;
    late_rate: number | null;
    low_review_rate: number | null;
  } | null;
};

export type RevenueFilters = {
  year?: string;
  category?: string;
  region?: string;
};

async function getJSON<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL.replace(/\/$/, "")}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Không kết nối được máy chủ dữ liệu. Kiểm tra backend và cấu hình VITE_API_BASE_URL, rồi tải lại trang.",
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(
      `API error ${res.status} on ${path}${data?.detail ? ` — ${data.detail}` : ""}`,
    );
  }
  return res.json();
}

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export const api = {
  // Manager dashboard
  kpiSummary: () => getJSON<KpiSummary>("/dashboard/kpi-summary"),
  revenueTrend: (filters: RevenueFilters = {}) => {
    const q = qs(filters);
    return getJSON<RevenueRow[]>(`/dashboard/revenue-trend${q ? `?${q}` : ""}`);
  },
  topProducts: (limit = 10, ascending = false) =>
    getJSON<TopProduct[]>(
      `/dashboard/top-products?limit=${limit}&ascending=${ascending}`,
    ),
  deliveryTrend: (region?: string) =>
    getJSON<DeliveryTrendRow[]>(`/dashboard/delivery-trend?${qs({ region })}`),
  deliveryRoutes: (limit = 10) =>
    getJSON<DeliveryRoute[]>(`/dashboard/delivery-routes?limit=${limit}`),
  reviewByDelay: () => getJSON<ReviewByDelay[]>("/dashboard/review-by-delay"),
  // Ops console
  riskSummary: (model: RiskModel) =>
    getJSON<RiskSummaryRow[]>(`/risk/${model}/summary`),
  riskyOrders: (
    model: RiskModel,
    params: { scope?: string; level?: string; limit?: number } = {},
  ) => getJSON<RiskyOrder[]>(`/risk/${model}/orders?${qs(params)}`),
  riskMetrics: () => getJSON<ModelMetrics[]>("/risk/metrics"),
  featureImportance: (model: RiskModel, limit = 8) =>
    getJSON<FeatureImportance[]>(`/risk/${model}/importance?limit=${limit}`),
  whatIf: (
    model: RiskModel,
    orderId: string,
    overrides: Record<string, number>,
  ) =>
    getJSON<WhatIfResult>(`/risk/${model}/what-if`, "POST", {
      order_id: orderId,
      overrides,
    }),
  // Công cụ dự đoán
  predictOptions: () => getJSON<PredictOptions>("/risk/predict/options"),
  routeDistance: (sellerState: string, customerState: string) =>
    getJSON<RouteDistance>(
      `/risk/predict/distance?${qs({ seller_state: sellerState, customer_state: customerState })}`,
    ),
  predict: (model: RiskModel, input: PredictInput) =>
    getJSON<PredictResult>(`/risk/${model}/predict`, "POST", input),
  // Campaign chăm sóc
  campaigns: () => getJSON<Campaign[]>("/campaigns"),
  createCampaign: (campaignName: string, description: string) =>
    getJSON<Campaign>("/campaigns", "POST", {
      campaign_name: campaignName,
      description,
    }),
  updateCampaign: (code: string, campaignName: string, description: string) =>
    getJSON<Campaign>(`/campaigns/${encodeURIComponent(code)}`, "PUT", {
      campaign_name: campaignName,
      description,
    }),
  deleteCampaign: (code: string) =>
    getJSON<{ deleted_targets: number }>(
      `/campaigns/${encodeURIComponent(code)}`,
      "DELETE",
    ),
  campaignTargets: (code: string, limit: number) =>
    getJSON<CampaignTargets>(
      `/campaigns/${encodeURIComponent(code)}/targets?limit=${limit}`,
    ),
  assignRiskyCustomers: (code: string, minRisk: number) =>
    getJSON<{ inserted: number }>(
      `/campaigns/${encodeURIComponent(code)}/targets?min_risk=${minRisk}`,
      "POST",
    ),
  clearTargets: (code: string) =>
    getJSON<{ deleted: number }>(
      `/campaigns/${encodeURIComponent(code)}/targets`,
      "DELETE",
    ),
};
