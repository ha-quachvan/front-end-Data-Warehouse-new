// Mã gốc vẫn được dùng khi gửi API; mapping chỉ thay đổi cách hiển thị.
export const BRAZIL_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};
export const stateName = (code: string | null | undefined) =>
  code
    ? BRAZIL_STATES[code]
      ? `${BRAZIL_STATES[code]} (${code})`
      : code
    : "Unknown";
export const categoryName = (value: string | null | undefined) =>
  value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Uncategorized";
export const optionName = (value: string) =>
  BRAZIL_STATES[value] ? stateName(value) : categoryName(value);

// Localize backend labels for display without changing API values.
const DELAY_BUCKET_LABELS: Record<string, string> = {
  "Sớm ≥ 10 ngày": "At least 10 days early",
  "Sớm 1-9 ngày": "1–9 days early",
  "Đúng ngày hẹn": "On time",
  "Trễ 1-3 ngày": "1–3 days late",
  "Trễ 4-7 ngày": "4–7 days late",
  "Trễ > 7 ngày": "More than 7 days late",
};
export const delayBucketName = (value: string) => {
  const normalized = value
    .replace(/[–—−]/g, "-")
    .replace(/>=/g, "≥")
    .replace(/\s+/g, " ")
    .trim();
  return DELAY_BUCKET_LABELS[normalized] ?? value;
};

const SOURCE_LABELS: Record<string, string> = {
  nhập: "User input",
  "trung vị tuyến": "Route median",
  "trung vị ngành": "Category median",
  "trung vị toàn sàn": "Overall marketplace median",
  "trung vị dữ liệu thật": "Historical median",
  "quy định sàn": "Marketplace policy",
  "tâm 2 bang": "State centers",
};
export const inputSourceName = (value: string) => SOURCE_LABELS[value] ?? value;

const REGION_LABELS: Record<string, string> = {
  Norte: "North",
  Nordeste: "Northeast",
  "Centro-Oeste": "Central-West",
  Sudeste: "Southeast",
  Sul: "South",
};
export const regionName = (value: string) => REGION_LABELS[value] ?? value;
