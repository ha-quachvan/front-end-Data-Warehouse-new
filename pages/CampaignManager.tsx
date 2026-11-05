import { stateName } from "../utils/format";
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { api, Campaign, CampaignTargets } from "../api";
import { DownloadList, ExportColumn, RowLimit } from "../components/ListTools";

const CAMPAIGN_COLUMNS: ExportColumn<Campaign>[] = [
  { header: "Code", value: (c) => c.campaign_code },
  { header: "Campaign name", value: (c) => c.campaign_name },
  { header: "Description", value: (c) => c.description },
  { header: "Customers", value: (c) => c.total_targets },
];

const CUSTOMER_COLUMNS: ExportColumn<CampaignTargets["customers"][number]>[] = [
  { header: "Customer ID", value: (c) => c.customer_id },
  { header: "City", value: (c) => c.city },
  { header: "State", value: (c) => stateName(c.state) },
  { header: "Order ID", value: (c) => c.order_id },
  {
    header: "Risk (%)",
    value: (c) => Number((Number(c.risk_score) * 100).toFixed(1)),
  },
  {
    header: "Assigned at",
    value: (c) => c.assigned_at.replace("T", " ").slice(0, 16),
  },
];

const th = {
  textAlign: "left" as const,
  borderBottom: "1px solid #ddd",
  padding: "6px 8px",
};
const td = {
  padding: "6px 8px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top" as const,
};
const input = {
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #ccc",
  borderRadius: 4,
  boxSizing: "border-box" as const,
};
const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;
// getJSON báo lỗi dạng "API error 409 on /campaigns — chi tiết": chỉ hiện phần chi tiết cho người dùng
const errorText = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).replace(/^API error .*? — /, "");

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
    onSubmit(name.trim(), description.trim())
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
        aria-label="Campaign name"
        placeholder="Campaign name"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        style={input}
      />
      <textarea
        aria-label="Campaign description"
        placeholder="Campaign description (optional)"
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
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>
      )}
    </form>
  );
}

function CampaignDetail({
  campaign,
  onChanged,
}: {
  campaign: Campaign;
  onChanged: () => void;
}) {
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
    if (
      !window.confirm(
        `Remove all assigned customers (${targets?.total}) from "${campaign.campaign_name}"?`,
      )
    )
      return;
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
        <b>Description:</b>{" "}
        {campaign.description ?? (
          <span style={{ color: "#888" }}>No description</span>
        )}
      </p>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {targets && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <b>Assigned customers: {targets.total}</b>
            {targets.avg_risk !== null && (
              <span>Average risk {pct(targets.avg_risk)}</span>
            )}
            {targets.total > 0 && (
              <button onClick={clear}>Remove all customers</button>
            )}
            {targets.total > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <RowLimit
                  limit={limit}
                  total={targets.total}
                  onChange={setLimit}
                />
                <DownloadList
                  rows={targets.customers}
                  columns={CUSTOMER_COLUMNS}
                  fileName={`customers_${code}_${targets.customers.length}_rows`}
                />
              </span>
            )}
          </div>
          {targets.total === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>
              No customers assigned yet. Assign customers in{" "}
              <a href="#/ops">Ops Console</a>.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div className="table-scroll">
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {[
                        "Customer",
                        "City",
                        "State",
                        "Order",
                        "Risk",
                        "Assigned at",
                      ].map((h) => (
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
                        <td style={td}>{stateName(c.state)}</td>
                        <td style={td}>{c.order_id.slice(0, 12)}…</td>
                        <td style={td}>{pct(c.risk_score)}</td>
                        <td style={td}>
                          {c.assigned_at.replace("T", " ").slice(0, 16)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      .then((rows) => {
        setCampaigns(rows);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(reload, [reload]);

  const shownCampaigns = campaigns?.slice(0, listLimit) ?? [];

  const remove = (c: Campaign) => {
    const extra =
      c.total_targets > 0
        ? ` and its assigned customers (${c.total_targets})`
        : "";
    if (!window.confirm(`Delete campaign "${c.campaign_name}"${extra}?`))
      return;
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
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Customer care campaigns</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Manage campaigns for customers at risk of leaving a low rating. Assign
        customers in <a href="#/ops">Ops Console</a>.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Create campaign</h2>
        <CampaignForm
          submitLabel="Create campaign"
          onSubmit={(name, description) =>
            api.createCampaign(name, description).then(reload)
          }
        />
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Campaign list</h2>
        {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
        {campaigns === null && !error && (
          <p role="status" className="empty-state">
            Loading campaigns…
          </p>
        )}
        {campaigns?.length === 0 && (
          <p style={{ fontSize: 13, color: "#888" }}>No campaigns yet.</p>
        )}
        {campaigns && campaigns.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              <RowLimit
                limit={listLimit}
                total={campaigns.length}
                onChange={setListLimit}
              />
              <DownloadList
                rows={shownCampaigns}
                columns={CAMPAIGN_COLUMNS}
                fileName={`campaigns_${shownCampaigns.length}_rows`}
              />
            </div>
            <div className="table-scroll">
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>Code</th>
                    <th style={th}>Campaign name</th>
                    <th style={{ ...th, textAlign: "right" }}>Customers</th>
                    <th style={{ ...th, width: 210 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shownCampaigns.map((c) => (
                    <Fragment key={c.campaign_code}>
                      <tr>
                        <td style={td}>{c.campaign_code}</td>
                        <td style={td}>{c.campaign_name}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {c.total_targets}
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              aria-expanded={openCode === c.campaign_code}
                              onClick={() =>
                                setOpenCode(
                                  openCode === c.campaign_code
                                    ? null
                                    : c.campaign_code,
                                )
                              }
                            >
                              {openCode === c.campaign_code
                                ? "Hide details"
                                : "Details"}
                            </button>
                            <button
                              onClick={() =>
                                setEditCode(
                                  editCode === c.campaign_code
                                    ? null
                                    : c.campaign_code,
                                )
                              }
                            >
                              Edit
                            </button>
                            <button onClick={() => remove(c)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {editCode === c.campaign_code && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              ...td,
                              background: "#f9fafb",
                              padding: 12,
                            }}
                          >
                            <CampaignForm
                              initial={c}
                              submitLabel="Save"
                              onCancel={() => setEditCode(null)}
                              onSubmit={(name, description) =>
                                api
                                  .updateCampaign(
                                    c.campaign_code,
                                    name,
                                    description,
                                  )
                                  .then(() => {
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
                          <td
                            colSpan={4}
                            style={{ ...td, background: "#f9fafb" }}
                          >
                            <CampaignDetail campaign={c} onChanged={reload} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
