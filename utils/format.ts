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
    : "Chưa xác định";
export const categoryName = (value: string | null | undefined) =>
  value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Chưa phân loại";
export const optionName = (value: string) =>
  BRAZIL_STATES[value] ? stateName(value) : categoryName(value);
