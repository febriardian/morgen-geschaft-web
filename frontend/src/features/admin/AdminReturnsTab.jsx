import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { API_BASE } from "../../config/constants.js";
import { auth } from "../../services/firebaseAuth.js";
import { adminDateLabel, formatIDR } from "../../utils/general.js";
import {
  getReturnIssueLabel,
  getReturnResolutionLabel,
  getReturnStatusMeta,
  resolveReturnEvidenceUrl,
} from "../orders/returnUtils.js";

const ADMIN_RETURN_STYLES = `
  .admin-returns-root { display: grid; gap: 14px; }
  .admin-returns-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
  }
  .admin-returns-head p {
    margin: 0 0 5px;
    color: #F59A1A;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: .1em;
  }
  .admin-returns-head h2 {
    margin: 0;
    color: #162B45;
    font-family: 'Fraunces', serif;
    font-size: 25px;
    font-weight: 500;
  }
  .admin-returns-head span {
    display: block;
    margin-top: 5px;
    color: #8F897E;
    font-size: 10px;
  }
  .admin-returns-refresh {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 11px;
    border: 1px solid #DCD4C5;
    border-radius: 9px;
    background: #FFFDF8;
    color: #173B5E;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .admin-returns-kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 9px;
  }
  .admin-return-kpi {
    padding: 13px;
    border: 1px solid #E3DCC9;
    border-radius: 10px;
    background: #FFFDF8;
  }
  .admin-return-kpi small {
    display: block;
    color: #8F897E;
    font-size: 9px;
  }
  .admin-return-kpi b {
    display: block;
    margin-top: 4px;
    color: #173B5E;
    font-family: 'Fraunces', serif;
    font-size: 23px;
  }
  .admin-return-toolbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(180px, .45fr);
    gap: 8px;
  }
  .admin-return-toolbar input,
  .admin-return-toolbar select,
  .admin-return-control input,
  .admin-return-control select,
  .admin-return-control textarea {
    width: 100%;
    border: 1px solid #DCD4C5;
    border-radius: 9px;
    background: #fff;
    color: #162B45;
    padding: 9px 10px;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    outline: none;
  }
  .admin-return-list { display: grid; gap: 8px; }
  .admin-return-card {
    border: 1px solid #E2DACD;
    border-radius: 11px;
    background: #FFFDF8;
    overflow: hidden;
  }
  .admin-return-summary {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(150px, .55fr) auto 24px;
    gap: 12px;
    align-items: center;
    padding: 13px 14px;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .admin-return-summary-main,
  .admin-return-summary-meta { min-width: 0; }
  .admin-return-summary-main b {
    display: block;
    overflow: hidden;
    color: #162B45;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .admin-return-summary-main small,
  .admin-return-summary-meta small {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: #918A7E;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .admin-return-summary-meta b {
    color: #4D473E;
    font-size: 10px;
  }
  .admin-return-pill {
    padding: 6px 8px;
    border: 1px solid currentColor;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
  }
  .admin-return-detail {
    display: grid;
    gap: 13px;
    padding: 14px;
    border-top: 1px solid #E8E0D4;
    background: #FBF8F2;
  }
  .admin-return-detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .admin-return-info-card {
    min-width: 0;
    padding: 11px;
    border: 1px solid #E6DED1;
    border-radius: 9px;
    background: #FFFDF8;
  }
  .admin-return-info-card > small,
  .admin-return-section-label {
    display: block;
    margin-bottom: 6px;
    color: #F59A1A;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    letter-spacing: .08em;
  }
  .admin-return-info-card b,
  .admin-return-info-card p {
    display: block;
    margin: 0;
    color: #4D473E;
    font-size: 10px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .admin-return-contact {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 7px;
    color: #173B5E;
    font-size: 9px;
    font-weight: 700;
    text-decoration: none;
  }
  .admin-return-items,
  .admin-return-history,
  .admin-return-notes { display: grid; gap: 6px; }
  .admin-return-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #EEE7DC;
    color: #5F594F;
    font-size: 10px;
  }
  .admin-return-evidence {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 7px;
  }
  .admin-return-evidence a {
    display: block;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid #DED5C8;
    border-radius: 8px;
    background: #F1ECE4;
  }
  .admin-return-evidence img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .admin-return-admin-message {
    padding: 11px;
    border-left: 3px solid #F59A1A;
    border-radius: 0 8px 8px 0;
    background: #FFF5E4;
    color: #5F564A;
    font-size: 10px;
    line-height: 1.6;
  }
  .admin-return-history-row,
  .admin-return-note-row {
    padding: 8px 9px;
    border: 1px solid #E7DFD2;
    border-radius: 8px;
    background: #FFFDF8;
  }
  .admin-return-history-row b,
  .admin-return-note-row b {
    color: #162B45;
    font-size: 9px;
  }
  .admin-return-history-row p,
  .admin-return-note-row p {
    margin: 3px 0 0;
    color: #716A5F;
    font-size: 9px;
    line-height: 1.5;
  }
  .admin-return-history-row small,
  .admin-return-note-row small {
    display: block;
    margin-top: 4px;
    color: #A19A8E;
    font-size: 8px;
  }
  .admin-return-controls {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid #DDD4C6;
    border-radius: 10px;
    background: #FFFDF8;
  }
  .admin-return-controls h4 {
    margin: 0;
    color: #162B45;
    font-family: 'Fraunces', serif;
    font-size: 16px;
    font-weight: 500;
  }
  .admin-return-controls > p {
    margin: -5px 0 0;
    color: #8C8579;
    font-size: 9px;
    line-height: 1.5;
  }
  .admin-return-control-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .admin-return-control {
    display: grid;
    gap: 5px;
  }
  .admin-return-control.full { grid-column: 1 / -1; }
  .admin-return-control > label {
    color: #6B6459;
    font-size: 9px;
    font-weight: 600;
  }
  .admin-return-control textarea {
    min-height: 76px;
    resize: vertical;
    line-height: 1.5;
  }
  .admin-return-checkbox {
    display: flex;
    gap: 7px;
    align-items: center;
    color: #5F594F;
    font-size: 9px;
  }
  .admin-return-checkbox input { accent-color: #173B5E; }
  .admin-return-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .admin-return-actions button {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 10px;
    border: 1px solid #D8D0C2;
    border-radius: 8px;
    background: #fff;
    color: #4C6354;
    font-size: 9px;
    font-weight: 700;
    cursor: pointer;
  }
  .admin-return-actions button.primary {
    border-color: #173B5E;
    background: #173B5E;
    color: #FFFDF8;
  }
  .admin-return-actions button.warning {
    border-color: #D79226;
    color: #9A6000;
  }
  .admin-return-actions button.danger {
    border-color: #C97B5E;
    color: #A9573D;
  }
  .admin-return-actions button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }
  .admin-return-operational-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .admin-return-alert {
    padding: 10px;
    border: 1px solid #EDC4B5;
    border-radius: 8px;
    background: #FFF0EA;
    color: #9C513B;
    font-size: 9px;
    line-height: 1.55;
  }
  .admin-return-success {
    padding: 10px;
    border: 1px solid #BFD8C9;
    border-radius: 8px;
    background: #EDF7F1;
    color: #2E6A4F;
    font-size: 9px;
  }
  @media (max-width: 980px) {
    .admin-returns-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .admin-return-detail-grid { grid-template-columns: 1fr 1fr; }
    .admin-return-evidence { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .admin-returns-head { align-items: flex-start; flex-direction: column; }
    .admin-return-toolbar,
    .admin-return-control-grid,
    .admin-return-operational-grid { grid-template-columns: 1fr; }
    .admin-return-summary {
      grid-template-columns: minmax(0, 1fr) auto 20px;
    }
    .admin-return-summary-meta { display: none; }
    .admin-return-detail-grid { grid-template-columns: 1fr; }
    .admin-return-evidence { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .admin-return-actions button { flex: 1; }
  }
`;

const EMPTY_DRAFT = {
  message: "",
  resolution: "replacement",
  refundAmount: "",
  returnRequired: false,
  returnInstructions: "",
  refundReference: "",
  replacementTracking: "",
  internalNote: "",
  riskReason: "",
};

function AdminReturnsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sesi admin tidak tersedia.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE}/api/admin/returns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal memuat komplain.");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (loadError) {
      setError(loadError.message || "Gagal memuat komplain.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const counts = useMemo(
    () => ({
      total: requests.length,
      new: requests.filter((item) => item.status === "submitted").length,
      action: requests.filter((item) => ["reviewing", "return_received"].includes(item.status))
        .length,
      waiting: requests.filter((item) =>
        ["waiting_customer", "return_in_transit"].includes(item.status)
      ).length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const haystack =
        `${request.id || ""} ${request.orderId || ""} ${request.customerName || ""} ${request.customerPhone || ""} ${request.customerEmail || ""}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [requests, search, statusFilter]);

  const openRequest = (request) => {
    const nextId = expandedId === request.documentId ? "" : request.documentId;
    setExpandedId(nextId);
    setError("");
    setSuccess("");
    if (nextId) {
      setDraft({
        ...EMPTY_DRAFT,
        resolution: request.resolution || request.requestedResolution || "replacement",
        refundAmount: String(
          request.refundAmount || request.claimedAmount || request.orderAmount || ""
        ),
        returnRequired: request.returnRequired === true,
        returnInstructions: request.returnInstructions || "",
        riskReason: request.customerRiskReason || "",
      });
    }
  };

  const updateLocalRequest = (updated) => {
    setRequests((current) =>
      current.map((item) =>
        item.documentId === (updated.documentId || updated.orderId)
          ? {
              ...updated,
              documentId: item.documentId,
              id: updated.id || item.id,
            }
          : item
      )
    );
  };

  const performAction = async (request, action, payload = {}) => {
    const confirmationActions = {
      approve: "Setujui pengajuan ini?",
      reject: "Tolak pengajuan ini?",
      set_risk: request.customerRiskFlag
        ? "Hapus tanda risiko dari akun pelanggan ini?"
        : "Tandai akun pelanggan ini berisiko untuk evaluasi COD mendatang?",
      mark_return_received: "Tandai barang retur sudah diterima?",
      complete:
        "Tandai refund/penggantian sudah benar-benar selesai? Tindakan ini dicatat pada riwayat pelanggan.",
    };
    if (confirmationActions[action] && !window.confirm(confirmationActions[action])) {
      return;
    }

    setBusy(`${request.documentId}:${action}`);
    setError("");
    setSuccess("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sesi admin tidak tersedia.");
      const token = await user.getIdToken();
      const response = await fetch(
        `${API_BASE}/api/admin/returns/${encodeURIComponent(request.orderId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action, ...payload }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Pengajuan tidak dapat diperbarui.");
      }
      if (data.request) updateLocalRequest(data.request);
      setSuccess(data.message || "Pengajuan berhasil diperbarui.");
      if (action === "save_note") {
        setDraft((current) => ({ ...current, internalNote: "" }));
      }
    } catch (actionError) {
      setError(actionError.message || "Pengajuan tidak dapat diperbarui.");
    } finally {
      setBusy("");
    }
  };

  const isBusy = (request, action) => busy === `${request.documentId}:${action}`;

  if (loading) {
    return (
      <div className="admin-returns-root">
        <style>{ADMIN_RETURN_STYLES}</style>
        <p className="admin-muted">Memuat komplain dan retur...</p>
      </div>
    );
  }

  return (
    <div className="admin-returns-root">
      <style>{ADMIN_RETURN_STYLES}</style>
      <div className="admin-returns-head">
        <div>
          <p>KOMPLAIN PELANGGAN</p>
          <h2>Komplain & Retur</h2>
          <span>Pemeriksaan bukti, persetujuan retur, refund, dan penggantian barang.</span>
        </div>
        <button type="button" className="admin-returns-refresh" onClick={loadRequests}>
          <RefreshCw size={13} /> Perbarui
        </button>
      </div>

      <div className="admin-returns-kpis">
        <div className="admin-return-kpi">
          <small>Total pengajuan</small>
          <b>{counts.total}</b>
        </div>
        <div className="admin-return-kpi">
          <small>Baru masuk</small>
          <b>{counts.new}</b>
        </div>
        <div className="admin-return-kpi">
          <small>Perlu tindakan admin</small>
          <b>{counts.action}</b>
        </div>
        <div className="admin-return-kpi">
          <small>Menunggu pelanggan/kurir</small>
          <b>{counts.waiting}</b>
        </div>
      </div>

      <div className="admin-return-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari ID retur, pesanan, nama, WhatsApp, atau email..."
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Semua status</option>
          <option value="submitted">Diajukan</option>
          <option value="reviewing">Sedang ditinjau</option>
          <option value="waiting_customer">Menunggu pelanggan</option>
          <option value="approved">Disetujui</option>
          <option value="return_in_transit">Retur sedang dikirim</option>
          <option value="return_received">Retur diterima</option>
          <option value="rejected">Ditolak</option>
          <option value="completed">Selesai</option>
        </select>
      </div>

      {error && <div className="admin-return-alert">{error}</div>}
      {success && <div className="admin-return-success">{success}</div>}

      <div className="admin-return-list">
        {filtered.length === 0 && (
          <p className="admin-muted">
            {requests.length === 0
              ? "Belum ada pengajuan komplain."
              : "Tidak ada pengajuan yang sesuai filter."}
          </p>
        )}

        {filtered.map((request) => {
          const meta = getReturnStatusMeta(request.status, "id");
          const expanded = expandedId === request.documentId;
          const phoneDigits = String(request.customerPhone || "")
            .replace(/\D/g, "")
            .replace(/^0/, "62");
          const canReview = request.status === "submitted";
          const canDecide = ["submitted", "reviewing"].includes(request.status);
          const canReject = ["submitted", "reviewing", "waiting_customer"].includes(request.status);
          const canComplete =
            request.status === "return_received" ||
            (request.status === "approved" && request.returnRequired !== true);

          return (
            <article key={request.documentId} className="admin-return-card">
              <button
                type="button"
                className="admin-return-summary"
                onClick={() => openRequest(request)}
              >
                <span className="admin-return-summary-main">
                  <b>
                    {request.customerName || "Pelanggan"} · {request.id}
                  </b>
                  <small>
                    {request.orderId} · {getReturnIssueLabel(request.issueType, "id")}
                  </small>
                </span>
                <span className="admin-return-summary-meta">
                  <b>{formatIDR(Number(request.claimedAmount || 0))}</b>
                  <small>{adminDateLabel(request.createdAt)}</small>
                </span>
                <span
                  className="admin-return-pill"
                  style={{ color: meta.color, background: meta.tone }}
                >
                  {meta.label}
                </span>
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {expanded && (
                <div className="admin-return-detail">
                  <div className="admin-return-detail-grid">
                    <section className="admin-return-info-card">
                      <small>PELANGGAN</small>
                      <b>{request.customerName || "-"}</b>
                      <p>{request.customerPhone || "-"}</p>
                      <p>{request.customerEmail || "-"}</p>
                      {phoneDigits && (
                        <a
                          className="admin-return-contact"
                          href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Halo ${request.customerName || ""}, kami dari Morgen Geschäft terkait pengajuan ${request.id} untuk pesanan ${request.orderId}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Hubungi WhatsApp <ExternalLink size={10} />
                        </a>
                      )}
                    </section>
                    <section className="admin-return-info-card">
                      <small>NILAI</small>
                      <p>
                        Total pesanan: <b>{formatIDR(Number(request.orderAmount || 0))}</b>
                      </p>
                      <p>
                        Produk diajukan: <b>{formatIDR(Number(request.claimedAmount || 0))}</b>
                      </p>
                      {request.refundAmount > 0 && (
                        <p>
                          Refund disetujui: <b>{formatIDR(Number(request.refundAmount))}</b>
                        </p>
                      )}
                    </section>
                    <section className="admin-return-info-card">
                      <small>RIWAYAT AKUN</small>
                      <p>
                        Pengajuan tercatat: <b>{request.customerComplaintCount || 1}</b>
                      </p>
                      <p>
                        Risiko:{" "}
                        <b>{request.customerRiskFlag ? "Ditandai admin" : "Tidak ditandai"}</b>
                      </p>
                      {request.customerRiskReason && <p>{request.customerRiskReason}</p>}
                    </section>
                  </div>

                  <section className="admin-return-info-card">
                    <small>DETAIL MASALAH</small>
                    <b>{getReturnIssueLabel(request.issueType, "id")}</b>
                    <p>{request.description}</p>
                    <p style={{ marginTop: 6 }}>
                      Permintaan pelanggan:{" "}
                      <b>{getReturnResolutionLabel(request.requestedResolution, "id")}</b>
                    </p>
                  </section>

                  <section className="admin-return-info-card">
                    <small>PRODUK DIAJUKAN</small>
                    <div className="admin-return-items">
                      {(request.selectedItems || []).map((item) => (
                        <div key={item.id} className="admin-return-item">
                          <span>
                            {item.name} · {item.qty} dari {item.orderedQty}
                          </span>
                          <b>{formatIDR(Number(item.claimedAmount || 0))}</b>
                        </div>
                      ))}
                    </div>
                  </section>

                  {request.evidence?.length > 0 && (
                    <section className="admin-return-info-card">
                      <small>BUKTI FOTO ({request.evidence.length})</small>
                      <div className="admin-return-evidence">
                        {request.evidence.map((item, index) => {
                          const url = resolveReturnEvidenceUrl(item.url, API_BASE);
                          return (
                            <a
                              key={`${item.url}-${index}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img src={url} alt={`Bukti ${index + 1}`} loading="lazy" />
                            </a>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {request.latestAdminMessage && (
                    <div className="admin-return-admin-message">
                      <b>Pesan terakhir kepada pelanggan:</b> {request.latestAdminMessage}
                    </div>
                  )}

                  {request.returnShipment && (
                    <section className="admin-return-info-card">
                      <small>PENGIRIMAN RETUR</small>
                      <p>
                        Kurir: <b>{request.returnShipment.courier || "-"}</b>
                      </p>
                      <p>
                        Resi: <b>{request.returnShipment.trackingNumber || "-"}</b>
                      </p>
                      <p>
                        Dikirim: <b>{adminDateLabel(request.returnShipment.submittedAt)}</b>
                      </p>
                      {request.returnShipment.receivedAt && (
                        <p>
                          Diterima: <b>{adminDateLabel(request.returnShipment.receivedAt)}</b>
                        </p>
                      )}
                    </section>
                  )}

                  {(canReview || canDecide || canReject) && (
                    <section className="admin-return-controls">
                      <h4>Pemeriksaan dan keputusan</h4>
                      <p>
                        Refund tidak berjalan otomatis. Setelah disetujui, proses refund melalui
                        Midtrans lalu catat referensinya saat menyelesaikan pengajuan.
                      </p>
                      <div className="admin-return-control-grid">
                        <div className="admin-return-control">
                          <label>Keputusan</label>
                          <select
                            value={draft.resolution}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                resolution: event.target.value,
                              }))
                            }
                          >
                            <option value="replacement">Penggantian barang</option>
                            <option value="refund">Refund</option>
                          </select>
                        </div>
                        {draft.resolution === "refund" && (
                          <div className="admin-return-control">
                            <label>Nominal refund</label>
                            <input
                              type="number"
                              min="1"
                              max={Number(request.orderAmount || 0)}
                              value={draft.refundAmount}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  refundAmount: event.target.value,
                                }))
                              }
                            />
                          </div>
                        )}
                        <div className="admin-return-control full">
                          <label>Pesan untuk pelanggan</label>
                          <textarea
                            value={draft.message}
                            maxLength={1000}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                message: event.target.value,
                              }))
                            }
                            placeholder="Wajib untuk permintaan bukti dan penolakan; opsional untuk persetujuan."
                          />
                        </div>
                        <label className="admin-return-checkbox">
                          <input
                            type="checkbox"
                            checked={draft.returnRequired}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                returnRequired: event.target.checked,
                              }))
                            }
                          />
                          Pelanggan wajib mengirim barang kembali
                        </label>
                        {draft.returnRequired && (
                          <div className="admin-return-control full">
                            <label>Instruksi dan alamat retur</label>
                            <textarea
                              value={draft.returnInstructions}
                              maxLength={1200}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  returnInstructions: event.target.value,
                                }))
                              }
                              placeholder="Tuliskan alamat, penerima, ketentuan kemasan, dan batas pengiriman."
                            />
                          </div>
                        )}
                      </div>
                      <div className="admin-return-actions">
                        {canReview && (
                          <button
                            type="button"
                            className="primary"
                            disabled={Boolean(busy)}
                            onClick={() => performAction(request, "start_review")}
                          >
                            <FileCheck2 size={12} />
                            {isBusy(request, "start_review") ? "Memproses..." : "Mulai tinjau"}
                          </button>
                        )}
                        {canDecide && (
                          <>
                            <button
                              type="button"
                              className="warning"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                performAction(request, "request_info", {
                                  message: draft.message,
                                })
                              }
                            >
                              Minta bukti tambahan
                            </button>
                            <button
                              type="button"
                              className="primary"
                              disabled={Boolean(busy)}
                              onClick={() =>
                                performAction(request, "approve", {
                                  message: draft.message,
                                  resolution: draft.resolution,
                                  refundAmount: Number(draft.refundAmount || 0),
                                  returnRequired: draft.returnRequired,
                                  returnInstructions: draft.returnInstructions,
                                })
                              }
                            >
                              <CheckCircle2 size={12} /> Setujui
                            </button>
                          </>
                        )}
                        {canReject && (
                          <button
                            type="button"
                            className="danger"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              performAction(request, "reject", {
                                message: draft.message,
                              })
                            }
                          >
                            Tolak dengan alasan
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {request.status === "waiting_customer" && (
                    <div className="admin-return-alert">
                      Menunggu jawaban atau bukti tambahan dari pelanggan. Setelah pelanggan
                      menjawab, status kembali menjadi Diajukan.
                    </div>
                  )}

                  {request.status === "approved" && request.returnRequired === true && (
                    <div className="admin-return-alert">
                      Retur sudah disetujui. Tunggu pelanggan memasukkan nomor resi sebelum menandai
                      barang diterima.
                    </div>
                  )}

                  {request.status === "return_in_transit" && (
                    <section className="admin-return-controls">
                      <h4>Konfirmasi barang retur</h4>
                      <p>
                        Periksa barang fisik terlebih dahulu sebelum melanjutkan ke refund atau
                        penggantian.
                      </p>
                      <div className="admin-return-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={Boolean(busy)}
                          onClick={() => performAction(request, "mark_return_received")}
                        >
                          <Truck size={12} /> Tandai retur diterima
                        </button>
                      </div>
                    </section>
                  )}

                  {canComplete && (
                    <section className="admin-return-controls">
                      <h4>Selesaikan pengajuan</h4>
                      <p>
                        Pastikan refund benar-benar diproses atau barang pengganti sudah dikirim
                        sebelum menekan selesai.
                      </p>
                      <div className="admin-return-control-grid">
                        {request.resolution === "refund" ? (
                          <div className="admin-return-control">
                            <label>Referensi refund Midtrans/bank</label>
                            <input
                              value={draft.refundReference}
                              maxLength={120}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  refundReference: event.target.value,
                                }))
                              }
                              placeholder="Contoh: MID-REF-..."
                            />
                          </div>
                        ) : (
                          <div className="admin-return-control">
                            <label>Nomor resi barang pengganti</label>
                            <input
                              value={draft.replacementTracking}
                              maxLength={120}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  replacementTracking: event.target.value,
                                }))
                              }
                              placeholder="Masukkan nomor resi"
                            />
                          </div>
                        )}
                        <div className="admin-return-control full">
                          <label>Pesan penyelesaian (opsional)</label>
                          <textarea
                            value={draft.message}
                            maxLength={1000}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                message: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="admin-return-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            performAction(request, "complete", {
                              message: draft.message,
                              refundReference: draft.refundReference,
                              replacementTracking: draft.replacementTracking,
                            })
                          }
                        >
                          <CheckCircle2 size={12} /> Tandai selesai
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="admin-return-operational-grid">
                    <section className="admin-return-controls">
                      <h4>Catatan internal</h4>
                      <p>Catatan ini hanya terlihat admin dan tidak dikirim kepada pelanggan.</p>
                      <div className="admin-return-control">
                        <textarea
                          value={draft.internalNote}
                          maxLength={1000}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              internalNote: event.target.value,
                            }))
                          }
                          placeholder="Hasil pemeriksaan, komunikasi, atau pertimbangan..."
                        />
                      </div>
                      <div className="admin-return-actions">
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            performAction(request, "save_note", {
                              internalNote: draft.internalNote,
                            })
                          }
                        >
                          Simpan catatan
                        </button>
                      </div>
                      {request.internalNotes?.length > 0 && (
                        <div className="admin-return-notes">
                          {request.internalNotes
                            .slice()
                            .reverse()
                            .slice(0, 5)
                            .map((note, index) => (
                              <div key={`${note.at}-${index}`} className="admin-return-note-row">
                                <p>{note.note}</p>
                                <small>
                                  {note.admin || "admin"} · {adminDateLabel(note.at)}
                                </small>
                              </div>
                            ))}
                        </div>
                      )}
                    </section>

                    <section className="admin-return-controls">
                      <h4>Perlindungan COD mendatang</h4>
                      <p>
                        Tanda risiko tersimpan pada profil pelanggan untuk pemeriksaan ketika COD
                        nanti diaktifkan.
                      </p>
                      <div className="admin-return-control">
                        <label>Alasan tanda risiko</label>
                        <textarea
                          value={draft.riskReason}
                          maxLength={500}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              riskReason: event.target.value,
                            }))
                          }
                          placeholder="Gunakan hanya jika ada pola penyalahgunaan yang jelas."
                        />
                      </div>
                      <div className="admin-return-actions">
                        <button
                          type="button"
                          className={request.customerRiskFlag ? "" : "danger"}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            performAction(request, "set_risk", {
                              riskFlag: !request.customerRiskFlag,
                              riskReason: request.customerRiskFlag ? "" : draft.riskReason,
                            })
                          }
                        >
                          <ShieldAlert size={12} />
                          {request.customerRiskFlag ? "Hapus tanda risiko" : "Tandai akun berisiko"}
                        </button>
                      </div>
                    </section>
                  </div>

                  <section className="admin-return-info-card">
                    <small>RIWAYAT STATUS</small>
                    <div className="admin-return-history">
                      {(request.statusHistory || [])
                        .slice()
                        .reverse()
                        .map((entry, index) => {
                          const historyMeta = getReturnStatusMeta(entry.status, "id");
                          return (
                            <div key={`${entry.at}-${index}`} className="admin-return-history-row">
                              <b style={{ color: historyMeta.color }}>{historyMeta.label}</b>
                              {entry.publicNote && <p>{entry.publicNote}</p>}
                              <small>
                                {entry.actor || "system"} · {adminDateLabel(entry.at)}
                              </small>
                            </div>
                          );
                        })}
                    </div>
                  </section>

                  {request.status === "completed" && (
                    <div className="admin-return-success">
                      <CheckCircle2 size={12} /> Pengajuan selesai.{" "}
                      {request.resolution === "refund"
                        ? `Referensi refund: ${request.refundReference || "-"}`
                        : `Resi penggantian: ${request.replacementTracking || "-"}`}
                    </div>
                  )}

                  {request.status === "rejected" && (
                    <div className="admin-return-alert">
                      <AlertTriangle size={12} /> Pengajuan ditolak dan alasan tersimpan pada
                      riwayat pelanggan.
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export { AdminReturnsTab };
