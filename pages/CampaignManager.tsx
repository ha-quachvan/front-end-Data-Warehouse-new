import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { api, Campaign, CampaignTargets } from "../api";
import { DownloadList, ExportColumn, RowLimit } from "../components/ListTools";

const CAMPAIGN_COLUMNS: ExportColumn<Campaign>[] = [
  { header: "Mã", value: (c) => c.campaign_code },
  { header: "Tên campaign", value: (c) => c.campaign_name },
  { header: "Mô tả", value: (c) => c.description },
  { header: "Số khách", value: (c) => c.total_targets },
];

const CUSTOMER_COLUMNS: ExportColumn<CampaignTargets["customers"][number]>[] = [
  { header: "customer_id", value: (c) => c.customer_id },
  { header: "Thành phố", value: (c) => c.city },
  { header: "Bang", value: (c) => c.state },
  { header: "order_id", value: (c) => c.order_id },
  { header: "Rủi ro (%)", value: (c) => Number((Number(c.risk_score) * 100).toFixed(1)) },
  { header: "Gắn lúc", value: (c) => c.assigned_at.replace("T", " ").slice(0, 16) },
];

const th = { textAlign: "left" as const, borderBottom: "1px solid #ddd", padding: "6px 8px" };
const td = { padding: "6px 8px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" as const };
const input = { padding: "6px 8px", fontSize: 13, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" as const };
const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;
// getJSON báo lỗi dạng "API error 409 on /campaigns — chi tiết": chỉ hiện phần chi tiết cho người dùng
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^API error .*? — /, "");

function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Campaign;
  submitLabel: string;
  onSubmit: (name: string, description: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.campaign_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    onSubmit(name, description)
      .then(() => {
        if (!initial) {
          setName("");
          setDescription("");
        }
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 640 }}>
      <input
        aria-label="Tên campaign"
        placeholder="Tên campaign"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        style={input}
      />
      <textarea
        aria-label="Mô tả campaign"
        placeholder="Mô tả campaign (không bắt buộc)"
        value={description}
        maxLength={1000}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        style={{ ...input, fontFamily: "inherit", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy || !name.trim()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Huỷ
          </button>
        )}
      </div>
      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}
    </form>
  );
}

function CampaignDetail({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [targets, setTargets] = useState<CampaignTargets | null>(null);
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const code = campaign.campaign_code;

  useEffect(() => {
    let stale = false; // bỏ kết quả của lần tải cũ nếu số dòng đã đổi
    api
      .campaignTargets(code, limit)
      .then((t) => {
        if (!stale) setTargets(t);
      })
      .catch((e) => {
        if (!stale) setError(errorText(e));
      });
    return () => {
      stale = true;
    };
  }, [code, limit]);

  const clear = () => {
    if (!window.confirm(`Xoá toàn bộ ${targets?.total} khách đã gắn khỏi "${campaign.campaign_name}"?`)) return;
    api
      .clearTargets(code)
      .then(() => api.campaignTargets(code, limit))
      .then((t) => {
        setTargets(t);
        onChanged();
      })
      .catch((e) => setError(errorText(e)));
  };

  return (
    <div style={{ padding: "4px 8px 16px", fontSize: 13 }}>
      <p style={{ margin: "4px 0 12px", whiteSpace: "pre-wrap" }}>
        <b>Mô tả:</b> {campaign.description ?? <span style={{ color: "#888" }}>Chưa có mô tả</span>}
      </p>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {targets && (
        <>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
            <b>Khách hàng đã gắn: {targets.total}</b>
            {targets.avg_risk !== null && <span>Rủi ro trung bình {pct(targets.avg_risk)}</span>}
            {targets.total > 0 && <button onClick={clear}>Xoá tệp đã gắn</button>}
            {targets.total > 0 && (
              <span style={{ marginLeft: "auto", display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <RowLimit limit={limit} total={targets.total} onChange={setLimit} />
                <DownloadList
                  rows={targets.customers}
                  columns={CUSTOMER_COLUMNS}
                  fileName={`khach_${code}_${targets.customers.length}_dong`}
                />
              </span>
            )}
          </div>
          {targets.total === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>
              Chưa có khách nào. Gắn khách bằng công cụ trong <a href="#/ops">Ops Console</a>.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Khách hàng", "Thành phố", "Bang", "Đơn", "Rủi ro", "Gắn lúc"].map((h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.customers.map((c) => (
                    <tr key={c.customer_id}>
                      <td style={td}>{c.customer_id.slice(0, 12)}…</td>
                      <td style={td}>{c.city}</td>
                      <td style={td}>{c.state}</td>
                      <td style={td}>{c.order_id.slice(0, 12)}…</td>
                      <td style={td}>{pct(c.risk_score)}</td>
                      <td style={td}>{c.assigned_at.replace("T", " ").slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [listLimit, setListLimit] = useState(50);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .campaigns()
      .then(setCampaigns)
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(reload, [reload]);

  const shownCampaigns = campaigns?.slice(0, listLimit) ?? [];

  const remove = (c: Campaign) => {
    const extra = c.total_targets > 0 ? ` và ${c.total_targets} khách đã gắn` : "";
    if (!window.confirm(`Xoá campaign "${c.campaign_name}"${extra}?`)) return;
    api
      .deleteCampaign(c.campaign_code)
      .then(() => {
        if (openCode === c.campaign_code) setOpenCode(null);
        reload();
      })
      .catch((e) => setError(errorText(e)));
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Campaign chăm sóc</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Quản lý các campaign dùng để chăm sóc khách hàng có rủi ro review thấp. Gắn khách vào campaign trong{" "}
        <a href="#/ops">Ops Console</a>.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Thêm campaign</h2>
        <CampaignForm
          submitLabel="Thêm campaign"
          onSubmit={(name, description) => api.createCampaign(name, description).then(reload)}
        />
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Danh sách campaign</h2>
        {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
        {campaigns?.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Chưa có campaign nào.</p>}
        {campaigns && campaigns.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 12, fontSize: 13, marginBottom: 8 }}>
              <RowLimit limit={listLimit} total={campaigns.length} onChange={setListLimit} />
              <DownloadList rows={shownCampaigns} columns={CAMPAIGN_COLUMNS} fileName={`campaign_${shownCampaigns.length}_dong`} />
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Mã</th>
                  <th style={th}>Tên campaign</th>
                  <th style={{ ...th, textAlign: "right" }}>Số khách</th>
                  <th style={{ ...th, width: 210 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shownCampaigns.map((c) => (
                  <Fragment key={c.campaign_code}>
                    <tr>
                      <td style={td}>{c.campaign_code}</td>
                      <td style={td}>{c.campaign_name}</td>
                      <td style={{ ...td, textAlign: "right" }}>{c.total_targets}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            aria-expanded={openCode === c.campaign_code}
                            onClick={() => setOpenCode(openCode === c.campaign_code ? null : c.campaign_code)}
                          >
                            {openCode === c.campaign_code ? "Ẩn chi tiết" : "Chi tiết"}
                          </button>
                          <button onClick={() => setEditCode(editCode === c.campaign_code ? null : c.campaign_code)}>Sửa</button>
                          <button onClick={() => remove(c)}>Xoá</button>
                        </div>
                      </td>
                    </tr>
                    {editCode === c.campaign_code && (
                      <tr>
                        <td colSpan={4} style={{ ...td, background: "#f9fafb", padding: 12 }}>
                          <CampaignForm
                            initial={c}
                            submitLabel="Lưu"
                            onCancel={() => setEditCode(null)}
                            onSubmit={(name, description) =>
                              api.updateCampaign(c.campaign_code, name, description).then(() => {
                                setEditCode(null);
                                reload();
                              })
                            }
                          />
                        </td>
                      </tr>
                    )}
                    {openCode === c.campaign_code && (
                      <tr>
                        <td colSpan={4} style={{ ...td, background: "#f9fafb" }}>
                          <CampaignDetail campaign={c} onChanged={reload} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
