import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, type Campaign, type CampaignTargets } from "../api";
import {
  DataState,
  DataTable,
  Notice,
  PageHeading,
  PanelHeading,
  RecordId,
  SectionHeading,
  TableFootnote,
  type Column,
} from "../components/Dashboard";
import {
  DownloadList,
  RowLimit,
  type ExportColumn,
} from "../components/ListTools";
import { stateName } from "../utils/format";
import { count, percent } from "../utils/display";

const campaignExport: ExportColumn<Campaign>[] = [
  { header: "Code", value: (c) => c.campaign_code },
  { header: "Campaign name", value: (c) => c.campaign_name },
  { header: "Description", value: (c) => c.description },
  { header: "Customers", value: (c) => c.total_targets },
];
type Customer = CampaignTargets["customers"][number];
const customerExport: ExportColumn<Customer>[] = [
  { header: "Customer ID", value: (c) => c.customer_id },
  { header: "City", value: (c) => c.city },
  { header: "State", value: (c) => stateName(c.state) },
  { header: "Order ID", value: (c) => c.order_id },
  { header: "Risk (%)", value: (c) => Number((c.risk_score * 100).toFixed(1)) },
  { header: "Assigned at", value: (c) => c.assigned_at },
];
const customerColumns: Column<Customer>[] = [
  {
    key: "id",
    label: "Customer ID",
    value: (c) => c.customer_id,
    render: (c) => <RecordId value={c.customer_id} />,
  },
  { key: "city", label: "City", value: (c) => c.city },
  {
    key: "state",
    label: "State",
    value: (c) => c.state,
    render: (c) => stateName(c.state),
  },
  {
    key: "order",
    label: "Order ID",
    value: (c) => c.order_id,
    render: (c) => <RecordId value={c.order_id} />,
  },
  {
    key: "risk",
    label: "Risk",
    value: (c) => Number(c.risk_score),
    numeric: true,
    render: (c) => <span className="delay-value">{percent(c.risk_score)}</span>,
  },
  {
    key: "assigned",
    label: "Assigned at",
    value: (c) => c.assigned_at,
    render: (c) => c.assigned_at.replace("T", " ").slice(0, 16),
  },
];
function CampaignForm({
  initial,
  onSubmit,
  onCancel,
  onBusyChange,
}: {
  initial?: Campaign;
  onSubmit: (name: string, description: string) => Promise<void>;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(initial?.campaign_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      await onSubmit(name.trim(), description.trim());
      if (!initial) {
        setName("");
        setDescription("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  return (
    <form className="campaign-form" onSubmit={submit}>
      <label className="form-field">
        <span>
          Campaign name <span className="required-mark">*</span>
        </span>
        <input
          aria-label="Campaign name"
          autoFocus
          required
          maxLength={100}
          placeholder="e.g. Post-delivery check-in"
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="form-field">
        <span>
          Campaign description <span className="muted">(optional)</span>
        </span>
        <textarea
          aria-label="Campaign description"
          rows={3}
          maxLength={1000}
          placeholder="Describe the purpose of this customer care campaign…"
          value={description}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && <Notice error>{error}</Notice>}
      <div className="form-actions">
        <span className="form-hint">
          {initial
            ? "Update the name and description for this campaign."
            : "Name required · Description optional"}
        </span>
        <div className="action-buttons">
          {onCancel && (
            <button
              className="button secondary"
              type="button"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy ? (
              <span className="spinner-dot" />
            ) : initial ? (
              <Check size={16} />
            ) : (
              <Plus size={16} />
            )}{" "}
            {busy ? "Saving…" : initial ? "Save" : "Create campaign"}
          </button>
        </div>
      </div>
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
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setError(null);
    api
      .campaignTargets(campaign.campaign_code, limit)
      .then((t) => {
        if (!stale) setTargets(t);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [campaign.campaign_code, campaign.total_targets, limit, attempt]);
  const clear = async () => {
    if (
      busy ||
      !window.confirm(
        `Remove all assigned customers (${targets?.total}) from "${campaign.campaign_name}"?`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api.clearTargets(campaign.campaign_code);
      setTargets(await api.campaignTargets(campaign.campaign_code, limit));
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="campaign-detail">
      <p className="campaign-description">
        <strong>Description</strong>
        <span>{campaign.description || "No description"}</span>
      </p>
      {error && (
        <Notice error>
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </Notice>
      )}
      {!targets && !error ? (
        <DataState status="loading" />
      ) : (
        targets && (
          <>
            <div className="detail-toolbar">
              <div className="detail-stats">
                <div>
                  <span>Assigned customers</span>
                  <strong>{count(targets.total)}</strong>
                </div>
                <div>
                  <span>Average risk</span>
                  <strong>{percent(targets.avg_risk)}</strong>
                </div>
                {targets.total > 0 && (
                  <button
                    className="button danger"
                    onClick={clear}
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                    {busy ? "Removing…" : "Remove all customers"}
                  </button>
                )}
              </div>
              {targets.total > 0 && (
                <div className="list-tools">
                  <RowLimit
                    limit={limit}
                    total={targets.total}
                    onChange={setLimit}
                  />
                  <DownloadList
                    rows={targets.customers}
                    columns={customerExport}
                    fileName={`customers_${campaign.campaign_code}_${targets.customers.length}_rows`}
                  />
                </div>
              )}
            </div>
            {targets.total === 0 ? (
              <div className="customers-empty">
                <Users size={28} />
                <h3>No customers assigned yet.</h3>
                <p>
                  Assign customers in <a href="#/ops">Ops Console</a>.
                </p>
              </div>
            ) : (
              <div className="customer-list">
                <DataTable
                  rows={targets.customers}
                  columns={customerColumns}
                  rowKey={(c) => `${c.customer_id}-${c.order_id}`}
                  label={`${campaign.campaign_name} customers`}
                />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(50);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const restoreCreateFocus = useRef(false);
  const closeCreate = () => {
    restoreCreateFocus.current = true;
    setCreateOpen(false);
  };
  useEffect(() => {
    if (!createOpen && !creating && restoreCreateFocus.current) {
      createButton.current?.focus();
      restoreCreateFocus.current = false;
    }
  }, [createOpen, creating]);
  const reload = () => setAttempt((n) => n + 1);
  useEffect(() => {
    let stale = false;
    setError(null);
    api
      .campaigns()
      .then((c) => {
        if (!stale) setCampaigns(c);
      })
      .catch((e) => {
        if (!stale) setError(String(e));
      });
    return () => {
      stale = true;
    };
  }, [attempt]);
  const remove = async (c: Campaign) => {
    if (
      deleting ||
      !window.confirm(
        `Delete campaign "${c.campaign_name}"${c.total_targets > 0 ? ` and its assigned customers (${c.total_targets})` : ""}?`,
      )
    )
      return;
    setDeleting(c.campaign_code);
    setError(null);
    try {
      await api.deleteCampaign(c.campaign_code);
      if (openCode === c.campaign_code) setOpenCode(null);
      if (editCode === c.campaign_code) setEditCode(null);
      setMessage(`Deleted "${c.campaign_name}".`);
      reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  };
  const shown = campaigns?.slice(0, listLimit) ?? [];
  return (
    <div className="campaign-page">
      <PageHeading
        title="Customer care campaigns"
        sourceDescription="Campaigns and assigned customers are read and saved through the configured backend. Ops Console uses the same campaign API. Downloads include the displayed rows and complete identifiers."
        actions={
          <button
            ref={createButton}
            className={`button ${createOpen ? "secondary" : "primary"}`}
            aria-expanded={createOpen}
            aria-controls="campaign-create"
            disabled={creating}
            onClick={createOpen ? closeCreate : () => setCreateOpen(true)}
          >
            {createOpen ? <X size={16} /> : <Plus size={16} />}
            {createOpen ? "Close form" : "Create campaign"}
          </button>
        }
      />
      {createOpen && (
        <section
          className="campaign-create"
          id="campaign-create"
          aria-label="Create campaign"
        >
          <SectionHeading
            title="Create campaign"
            aside="Name required · Description optional"
          />
          <div className="surface form-panel">
            <CampaignForm
              onCancel={closeCreate}
              onBusyChange={setCreating}
              onSubmit={async (name, description) => {
                await api.createCampaign(name, description);
                setMessage(`Created "${name}".`);
                reload();
                closeCreate();
              }}
            />
          </div>
        </section>
      )}
      <section className="dashboard-section">
        <SectionHeading title="Campaigns" />
        <div className="surface">
          <div className="table-toolbar">
            <PanelHeading
              title={`${campaigns?.length ?? "…"} ${campaigns?.length === 1 ? "campaign" : "campaigns"}`}
              description="View assigned customers or manage a campaign without leaving the list."
            />
            <div className="list-tools">
              <RowLimit
                limit={listLimit}
                total={campaigns?.length ?? null}
                onChange={setListLimit}
              />
              <DownloadList
                rows={shown}
                columns={campaignExport}
                fileName={`campaigns_${shown.length}_rows`}
              />
            </div>
          </div>
          {message && (
            <Notice>
              <Check size={14} />
              {message}
            </Notice>
          )}
          {error && (
            <Notice error>
              {error}{" "}
              <button className="text-button" onClick={reload}>
                Try again
              </button>
            </Notice>
          )}
          {campaigns === null && !error ? (
            <DataState status="loading" title="Loading campaigns…" />
          ) : campaigns?.length === 0 ? (
            <DataState
              status="empty"
              title="No campaigns yet."
              description="Select Create campaign to get started."
            />
          ) : (
            campaigns && (
              <div
                className="table-scroll"
                role="region"
                aria-label="Campaign list"
                tabIndex={0}
              >
                <table className="campaign-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Campaign name</th>
                      <th className="numeric">Customers</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <Fragment key={c.campaign_code}>
                        <tr>
                          <td>
                            <span className="campaign-code">
                              {c.campaign_code}
                            </span>
                          </td>
                          <td className="campaign-name">{c.campaign_name}</td>
                          <td className="numeric">
                            <span
                              className={`customer-count ${c.total_targets ? "has-customers" : ""}`}
                            >
                              {count(c.total_targets)}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="button secondary small"
                                aria-expanded={openCode === c.campaign_code}
                                onClick={() => {
                                  setOpenCode((v) =>
                                    v === c.campaign_code
                                      ? null
                                      : c.campaign_code,
                                  );
                                  setEditCode(null);
                                }}
                              >
                                {openCode === c.campaign_code ? (
                                  <ChevronUp size={13} />
                                ) : (
                                  <ChevronDown size={13} />
                                )}{" "}
                                {openCode === c.campaign_code
                                  ? "Hide details"
                                  : "Details"}
                              </button>
                              <button
                                className="button secondary small"
                                onClick={() => {
                                  setEditCode((v) =>
                                    v === c.campaign_code
                                      ? null
                                      : c.campaign_code,
                                  );
                                  setOpenCode(null);
                                }}
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                              <button
                                className="button danger small"
                                disabled={deleting !== null}
                                onClick={() => remove(c)}
                              >
                                <Trash2 size={13} />
                                {deleting === c.campaign_code
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editCode === c.campaign_code && (
                          <tr>
                            <td colSpan={4} className="expansion-cell">
                              <div className="campaign-edit">
                                <div className="handling-title">
                                  <h3>Edit campaign</h3>
                                  <button
                                    className="icon-button"
                                    aria-label="Close edit form"
                                    onClick={() => setEditCode(null)}
                                  >
                                    <X size={17} />
                                  </button>
                                </div>
                                <CampaignForm
                                  initial={c}
                                  onCancel={() => setEditCode(null)}
                                  onSubmit={async (name, description) => {
                                    await api.updateCampaign(
                                      c.campaign_code,
                                      name,
                                      description,
                                    );
                                    setEditCode(null);
                                    setMessage(`Saved "${name}".`);
                                    reload();
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        {openCode === c.campaign_code && (
                          <tr>
                            <td colSpan={4} className="expansion-cell">
                              <CampaignDetail campaign={c} onChanged={reload} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          <TableFootnote>
            Showing {shown.length} of {campaigns?.length ?? "…"} campaigns.
            Downloads include the displayed rows and complete identifiers.
          </TableFootnote>
        </div>
      </section>
    </div>
  );
}
