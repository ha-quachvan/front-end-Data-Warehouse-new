export const money = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(/^R\$/, "R$ ");
export const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const percent = (value: number | null) =>
  value === null ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
export const count = (value: number) => Number(value).toLocaleString("en-US");
export const monthLabel = (value: string) =>
  /^\d{4}-\d{2}$/.test(value)
    ? new Date(`${value}-01T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      })
    : value;
export const dateLabel = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
};
export const axisStyle = { fontSize: 12, fill: "#64748b" };
export const tooltipStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 16px #15234012",
};

const featureLabels: Record<string, string> = {
  distance_km: "Route distance",
  estimated_days: "Estimated delivery",
  carrier_days: "Carrier handoff",
  delay_days: "Delivery delay",
  actual_days: "Delivery duration",
  shipping_limit_days: "Handoff deadline",
  approval_hours: "Order approval",
  n_items: "Number of items",
  total_price: "Order value",
  total_freight: "Shipping cost",
  total_weight_g: "Weight",
  total_volume_cm3: "Volume",
  category: "Product category",
  route_late_rate: "Route delay history",
  route_low_review_rate: "Route rating history",
};
export const featureName = (value: string) =>
  featureLabels[value] ??
  value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
