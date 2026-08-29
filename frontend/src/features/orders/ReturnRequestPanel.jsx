import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImagePlus,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { API_BASE } from "../../config/constants.js";
import { getOrderAccessToken } from "../../utils/paymentStorage.js";
import { formatIDR, resolveProductImage } from "../../utils/general.js";
import { customerAuthorizationHeader } from "../../services/customerAuth.js";
import {
  RETURN_ISSUE_OPTIONS,
  RETURN_RESOLUTION_OPTIONS,
  getReturnIssueLabel,
  getReturnResolutionLabel,
  getReturnStatusMeta,
  resolveReturnEvidenceUrl,
} from "./returnUtils.js";

const RETURN_PANEL_STYLES = `
  .customer-return-panel {
    margin-top: 16px;
    border: 1px solid #E3D8C6;
    border-radius: 12px;
    background: #FFFDF8;
    overflow: hidden;
  }
  .customer-return-intro,
  .customer-return-status-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    padding: 17px;
  }
  .customer-return-title {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    min-width: 0;
  }
  .customer-return-icon {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #EEF3F7;
    color: #173B5E;
  }
  .customer-return-title h3 {
    margin: 0;
    color: #162B45;
    font-family: 'Fraunces', serif;
    font-size: 17px;
    font-weight: 500;
  }
  .customer-return-title p {
    margin: 5px 0 0;
    color: #756E62;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    line-height: 1.6;
  }
  .customer-return-primary,
  .customer-return-secondary {
    min-height: 38px;
    padding: 9px 13px;
    border-radius: 9px;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .customer-return-primary {
    border: 1px solid #173B5E;
    background: #173B5E;
    color: #FFFDF8;
  }
  .customer-return-primary:disabled {
    border-color: #BDB5A8;
    background: #BDB5A8;
    cursor: not-allowed;
  }
  .customer-return-secondary {
    border: 1px solid #D7CDBD;
    background: #FFFDF8;
    color: #4C6354;
  }
  .customer-return-expired {
    display: flex;
    gap: 9px;
    align-items: flex-start;
    padding: 13px 15px;
    border-top: 1px solid #ECE5D9;
    background: #F8F4ED;
    color: #776F63;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    line-height: 1.6;
  }
  .customer-return-form {
    display: grid;
    gap: 16px;
    padding: 18px;
    border-top: 1px solid #E8E0D3;
    background: #FBF8F2;
  }
  .customer-return-form-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .customer-return-form-head h4,
  .customer-return-block h4 {
    margin: 0;
    color: #162B45;
    font-family: 'Work Sans', sans-serif;
    font-size: 12px;
    font-weight: 700;
  }
  .customer-return-form-head p,
  .customer-return-block > p {
    margin: 4px 0 0;
    color: #8A8377;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    line-height: 1.55;
  }
  .customer-return-form-head button {
    border: 0;
    background: transparent;
    color: #8A8377;
    font-size: 11px;
    cursor: pointer;
  }
  .customer-return-items {
    display: grid;
    gap: 8px;
    margin-top: 9px;
  }
  .customer-return-item {
    display: grid;
    grid-template-columns: 22px 42px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    padding: 9px;
    border: 1px solid #E4DCCD;
    border-radius: 9px;
    background: #FFFDF8;
  }
  .customer-return-item.selected {
    border-color: rgba(23,59,94,.48);
    background: #F7FAFC;
  }
  .customer-return-item input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: #173B5E;
  }
  .customer-return-item img,
  .customer-return-item-placeholder {
    width: 42px;
    height: 42px;
    border: 1px solid #E6DED1;
    border-radius: 7px;
    object-fit: cover;
    background: #F3EEE5;
  }
  .customer-return-item-copy {
    min-width: 0;
  }
  .customer-return-item-copy b {
    display: block;
    overflow: hidden;
    color: #162B45;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .customer-return-item-copy small {
    display: block;
    margin-top: 3px;
    color: #979083;
    font-family: 'Work Sans', sans-serif;
    font-size: 9px;
  }
  .customer-return-item select {
    min-width: 70px;
    border: 1px solid #D8CFC0;
    background: #fff;
    padding: 7px;
    color: #162B45;
    font-size: 10px;
  }
  .customer-return-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px;
  }
  .customer-return-field {
    display: grid;
    gap: 6px;
  }
  .customer-return-field.full {
    grid-column: 1 / -1;
  }
  .customer-return-field label,
  .customer-return-upload-label {
    color: #645D52;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    font-weight: 600;
  }
  .customer-return-field select,
  .customer-return-field textarea,
  .customer-return-field input {
    width: 100%;
    border: 1px solid #DAD1C2;
    border-radius: 9px;
    background: #fff;
    padding: 10px 11px;
    color: #162B45;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    outline: none;
  }
  .customer-return-field textarea {
    min-height: 108px;
    resize: vertical;
    line-height: 1.55;
  }
  .customer-return-field select:focus,
  .customer-return-field textarea:focus,
  .customer-return-field input:focus {
    border-color: #173B5E;
    box-shadow: 0 0 0 3px rgba(23,59,94,.08);
  }
  .customer-return-resolution-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .customer-return-resolution {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px;
    border: 1px solid #E0D7C8;
    border-radius: 9px;
    background: #FFFDF8;
    color: #4F493F;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    cursor: pointer;
  }
  .customer-return-resolution.active {
    border-color: #173B5E;
    background: #F3F7FA;
    color: #162B45;
  }
  .customer-return-resolution input {
    accent-color: #173B5E;
  }
  .customer-return-file-box {
    margin-top: 8px;
    padding: 12px;
    border: 1px dashed #CFC4B3;
    border-radius: 9px;
    background: #FFFDF8;
  }
  .customer-return-file-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #EEF3F7;
    color: #173B5E;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }
  .customer-return-file-trigger input {
    display: none;
  }
  .customer-return-file-list {
    display: grid;
    gap: 4px;
    margin: 9px 0 0;
    padding: 0;
    color: #756E62;
    font-family: 'Work Sans', sans-serif;
    font-size: 9px;
    list-style: none;
  }
  .customer-return-policy {
    display: flex;
    gap: 9px;
    align-items: flex-start;
    padding: 11px;
    border: 1px solid #E5DCCD;
    border-radius: 9px;
    background: #FFFDF8;
    color: #6E675B;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    line-height: 1.55;
  }
  .customer-return-policy input {
    margin-top: 2px;
    accent-color: #173B5E;
  }
  .customer-return-feedback {
    margin: 0;
    padding: 10px 11px;
    border-radius: 8px;
    background: #FFF0EA;
    color: #A9573D;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    line-height: 1.55;
  }
  .customer-return-feedback.success {
    background: #EAF5EF;
    color: #2E6A4F;
  }
  .customer-return-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .customer-return-status-head {
    border-bottom: 1px solid #E9E2D6;
  }
  .customer-return-status-id {
    display: block;
    margin-top: 5px;
    color: #918A7D;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
  }
  .customer-return-status-pill {
    flex-shrink: 0;
    padding: 7px 10px;
    border: 1px solid currentColor;
    border-radius: 8px;
    font-family: 'Work Sans', sans-serif;
    font-size: 9px;
    font-weight: 700;
  }
  .customer-return-status-body {
    display: grid;
    gap: 14px;
    padding: 17px;
  }
  .customer-return-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .customer-return-summary-grid > div {
    padding: 10px;
    border: 1px solid #E9E1D5;
    border-radius: 8px;
    background: #FBF8F2;
  }
  .customer-return-summary-grid small {
    display: block;
    margin-bottom: 4px;
    color: #9A9387;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    letter-spacing: .05em;
  }
  .customer-return-summary-grid b {
    color: #162B45;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
  }
  .customer-return-message {
    padding: 12px;
    border-left: 3px solid #F59A1A;
    border-radius: 0 8px 8px 0;
    background: #FFF7E8;
  }
  .customer-return-message small {
    display: block;
    margin-bottom: 5px;
    color: #A86200;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    letter-spacing: .07em;
  }
  .customer-return-message p {
    margin: 0;
    color: #5F564A;
    font-family: 'Work Sans', sans-serif;
    font-size: 11px;
    line-height: 1.65;
  }
  .customer-return-product-list {
    display: grid;
    gap: 6px;
  }
  .customer-return-product-list > div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #EFE8DD;
    color: #5F594F;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
  }
  .customer-return-evidence-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
  }
  .customer-return-evidence-grid a {
    display: block;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid #E3DACE;
    border-radius: 8px;
    background: #F4EFE7;
  }
  .customer-return-evidence-grid img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .customer-return-timeline {
    display: grid;
    gap: 0;
  }
  .customer-return-history-row {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 9px;
    min-height: 46px;
  }
  .customer-return-history-marker {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .customer-return-history-marker::after {
    content: '';
    position: absolute;
    top: 16px;
    bottom: 0;
    width: 1px;
    background: #DDD5C8;
  }
  .customer-return-history-row:last-child .customer-return-history-marker::after {
    display: none;
  }
  .customer-return-history-marker span {
    position: relative;
    z-index: 1;
    width: 10px;
    height: 10px;
    margin-top: 3px;
    border: 2px solid #FFFDF8;
    border-radius: 50%;
    background: #173B5E;
    box-shadow: 0 0 0 1px #173B5E;
  }
  .customer-return-history-copy b {
    display: block;
    color: #162B45;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
  }
  .customer-return-history-copy p {
    margin: 3px 0 0;
    color: #756E62;
    font-family: 'Work Sans', sans-serif;
    font-size: 9px;
    line-height: 1.5;
  }
  .customer-return-history-copy time {
    display: block;
    margin-top: 3px;
    color: #A09A8F;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
  }
  .customer-return-followup {
    display: grid;
    gap: 10px;
    padding: 13px;
    border: 1px solid #E3D9CA;
    border-radius: 10px;
    background: #FBF8F2;
  }
  .customer-return-followup h4 {
    margin: 0;
    color: #162B45;
    font-family: 'Fraunces', serif;
    font-size: 15px;
    font-weight: 500;
  }
  .customer-return-followup p {
    margin: 0;
    color: #756E62;
    font-family: 'Work Sans', sans-serif;
    font-size: 10px;
    line-height: 1.6;
  }
  @media (max-width: 640px) {
    .customer-return-intro,
    .customer-return-status-head {
      flex-direction: column;
    }
    .customer-return-intro > button {
      width: 100%;
    }
    .customer-return-fields,
    .customer-return-summary-grid,
    .customer-return-resolution-grid {
      grid-template-columns: 1fr;
    }
    .customer-return-item {
      grid-template-columns: 22px 38px minmax(0, 1fr);
    }
    .customer-return-item img,
    .customer-return-item-placeholder {
      width: 38px;
      height: 38px;
    }
    .customer-return-item select {
      grid-column: 3;
      width: 100%;
    }
    .customer-return-evidence-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .customer-return-actions > button {
      flex: 1;
    }
  }
`;

function formatReturnDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale === "en" ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileValidation(files, maxCount = 3) {
  const selected = Array.from(files || []);
  if (selected.length > maxCount) {
    return {
      files: [],
      error: `Maksimal ${maxCount} foto untuk satu kiriman.`,
    };
  }
  const invalid = selected.find(
    (file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024
  );
  if (invalid) {
    return {
      files: [],
      error: "Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 2 MB per foto.",
    };
  }
  return { files: selected, error: "" };
}

function ReturnRequestPanel({ order, phone, onRefresh, products = [] }) {
  const customerAccessToken = getOrderAccessToken(order?.id);
  const locale = order?.locale === "en" ? "en" : "id";
  const t = (id, en) => (locale === "en" ? en : id);
  const request = order?.returnRequest || null;
  const eligibility = order?.returnEligibility || null;
  const [showForm, setShowForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [issueType, setIssueType] = useState("damaged_or_leaking");
  const [description, setDescription] = useState("");
  const [requestedResolution, setRequestedResolution] = useState("replacement");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState("");
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [replying, setReplying] = useState(false);
  const [shippingCourier, setShippingCourier] = useState("");
  const [shippingTracking, setShippingTracking] = useState("");
  const [savingShipment, setSavingShipment] = useState(false);

  useEffect(() => {
    setShowForm(false);
    setSelectedItems({});
    setIssueType("damaged_or_leaking");
    setDescription("");
    setRequestedResolution("replacement");
    setEvidenceFiles([]);
    setPolicyAccepted(false);
    setFeedback("");
    setSuccess("");
    setReply("");
    setReplyFiles([]);
    setShippingCourier("");
    setShippingTracking("");
  }, [order?.id]);

  const selectedPayload = useMemo(
    () =>
      Object.entries(selectedItems).map(([id, qty]) => ({
        id,
        qty: Number(qty),
      })),
    [selectedItems]
  );
  const requestMeta = getReturnStatusMeta(request?.status, locale);
  const maxReplyFiles = Math.max(0, Math.min(3, 9 - Number(request?.evidence?.length || 0)));

  const chooseItem = (item, checked) => {
    setSelectedItems((current) => {
      const next = { ...current };
      if (checked) next[item.id] = 1;
      else delete next[item.id];
      return next;
    });
  };

  const updateItemQuantity = (itemId, quantity) => {
    setSelectedItems((current) => ({
      ...current,
      [itemId]: Number(quantity),
    }));
  };

  const submitRequest = async () => {
    setFeedback("");
    setSuccess("");
    if (selectedPayload.length === 0) {
      setFeedback(t("Pilih minimal satu produk.", "Select at least one item."));
      return;
    }
    if (description.trim().length < 20) {
      setFeedback(
        t("Jelaskan masalah minimal 20 karakter.", "Describe the issue in at least 20 characters.")
      );
      return;
    }
    if (evidenceFiles.length < 1) {
      setFeedback(t("Unggah minimal satu foto bukti.", "Upload at least one evidence photo."));
      return;
    }
    if (!policyAccepted) {
      setFeedback(
        t("Centang persetujuan kebijakan sebelum mengirim.", "Accept the policy before submitting.")
      );
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("orderId", order.id);
      formData.append("phone", phone);
      formData.append("locale", locale);
      formData.append("issueType", issueType);
      formData.append("description", description.trim());
      formData.append("requestedResolution", requestedResolution);
      formData.append("selectedItems", JSON.stringify(selectedPayload));
      formData.append("policyAccepted", "true");
      evidenceFiles.forEach((file) => formData.append("evidence", file));

      const accountHeaders = await customerAuthorizationHeader().catch(() => ({}));
      const response = await fetch(`${API_BASE}/api/returns`, {
        method: "POST",
        headers: { ...(customerAccessToken ? { "X-Customer-Access-Token": customerAccessToken } : {}), ...accountHeaders },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          locale === "en"
            ? "The claim could not be submitted. Check the form and try again."
            : data.error || "Pengajuan tidak dapat dikirim."
        );
      }

      setSuccess(
        t("Pengajuan berhasil dikirim dan akan ditinjau.", "Your claim was submitted for review.")
      );
      setShowForm(false);
      await onRefresh?.();
    } catch (error) {
      setFeedback(error.message || t("Gagal mengirim pengajuan.", "Submission failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    setFeedback("");
    setSuccess("");
    if (!reply.trim() && replyFiles.length === 0) {
      setFeedback(t("Isi jawaban atau tambahkan bukti.", "Enter a response or add evidence."));
      return;
    }
    setReplying(true);
    try {
      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("message", reply.trim());
      replyFiles.forEach((file) => formData.append("evidence", file));
      const accountHeaders = await customerAuthorizationHeader().catch(() => ({}));
      const response = await fetch(
        `${API_BASE}/api/returns/${encodeURIComponent(order.id)}/response`,
        {
          method: "POST",
          headers: { ...(customerAccessToken ? { "X-Customer-Access-Token": customerAccessToken } : {}), ...accountHeaders },
          body: formData,
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          locale === "en"
            ? "Your response could not be sent."
            : data.error || "Jawaban tidak dapat dikirim."
        );
      }
      setReply("");
      setReplyFiles([]);
      setSuccess(t("Jawaban tambahan berhasil dikirim.", "Your additional response was sent."));
      await onRefresh?.();
    } catch (error) {
      setFeedback(error.message || t("Gagal mengirim jawaban.", "Response failed."));
    } finally {
      setReplying(false);
    }
  };

  const submitShipment = async () => {
    setFeedback("");
    setSuccess("");
    if (shippingCourier.trim().length < 2 || shippingTracking.trim().length < 4) {
      setFeedback(
        t("Isi nama kurir dan nomor resi retur.", "Enter the courier and return tracking number.")
      );
      return;
    }
    setSavingShipment(true);
    try {
      const accountHeaders = await customerAuthorizationHeader().catch(() => ({}));
      const response = await fetch(
        `${API_BASE}/api/returns/${encodeURIComponent(order.id)}/shipment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customerAccessToken ? { "X-Customer-Access-Token": customerAccessToken } : {}),
            ...accountHeaders,
          },
          body: JSON.stringify({
            phone,
            courier: shippingCourier.trim(),
            trackingNumber: shippingTracking.trim(),
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          locale === "en"
            ? "Return-shipment details could not be saved."
            : data.error || "Data pengiriman retur tidak dapat disimpan."
        );
      }
      setSuccess(
        t("Data pengiriman retur berhasil disimpan.", "Return-shipment details were saved.")
      );
      await onRefresh?.();
    } catch (error) {
      setFeedback(error.message || t("Gagal menyimpan resi.", "Could not save tracking."));
    } finally {
      setSavingShipment(false);
    }
  };

  if (!request && order?.status !== "delivered") return null;

  if (!request) {
    return (
      <section className="customer-return-panel">
        <style>{RETURN_PANEL_STYLES}</style>
        <div className="customer-return-intro">
          <div className="customer-return-title">
            <span className="customer-return-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3>{t("Ada masalah dengan pesanan?", "Problem with your order?")}</h3>
              <p>
                {eligibility?.eligible
                  ? t(
                      `Ajukan komplain sebelum ${formatReturnDate(eligibility.deadline, locale)}. Barang jangan dikirim balik sebelum disetujui admin.`,
                      `Submit a claim before ${formatReturnDate(eligibility.deadline, locale)}. Do not send anything back before admin approval.`
                    )
                  : t("Masa pengajuan komplain sudah berakhir.", "The claim window has ended.")}
              </p>
            </div>
          </div>
          {eligibility?.eligible && (
            <button
              type="button"
              className="customer-return-primary"
              onClick={() => {
                setFeedback("");
                setShowForm((current) => !current);
              }}
            >
              {showForm
                ? t("Tutup formulir", "Close form")
                : t("Ajukan komplain", "Submit a claim")}
            </button>
          )}
        </div>

        {!eligibility?.eligible && (
          <div className="customer-return-expired">
            <Clock3 size={15} />
            <span>
              {t(
                "Komplain melalui sistem tersedia maksimal 3×24 jam setelah pesanan diterima. Untuk bantuan lain, hubungi admin.",
                "System claims are available for up to 72 hours after delivery. Contact admin for other assistance."
              )}
            </span>
          </div>
        )}

        {showForm && eligibility?.eligible && (
          <div className="customer-return-form">
            <div className="customer-return-form-head">
              <div>
                <h4>{t("Formulir komplain", "Claim form")}</h4>
                <p>
                  {t(
                    "Isi semua data dengan benar agar pemeriksaan lebih cepat.",
                    "Provide complete details to help the review."
                  )}
                </p>
              </div>
              <button type="button" onClick={() => setShowForm(false)}>
                {t("Batal", "Cancel")}
              </button>
            </div>

            <div className="customer-return-block">
              <h4>{t("1. Pilih produk bermasalah", "1. Select affected items")}</h4>
              <div className="customer-return-items">
                {(order.items || []).map((item, index) => {
                  const itemId = String(item.id || `item-${index}`);
                  const checked = selectedItems[itemId] !== undefined;
                  const latestProduct = products.find(
                    (product) => String(product.id) === String(item.id)
                  );
                  const image = resolveProductImage(
                    latestProduct?.image ||
                      latestProduct?.images?.[0] ||
                      item.image ||
                      item.images?.[0] ||
                      ""
                  );
                  const safeItem = { ...item, id: itemId };
                  return (
                    <label
                      key={itemId}
                      className={`customer-return-item ${checked ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => chooseItem(safeItem, event.target.checked)}
                      />
                      {image ? (
                        <img src={image} alt="" loading="lazy" />
                      ) : (
                        <span className="customer-return-item-placeholder" />
                      )}
                      <span className="customer-return-item-copy">
                        <b>{item.name}</b>
                        <small>
                          {item.qty} × {formatIDR(Number(item.price || 0))}
                        </small>
                      </span>
                      {checked && (
                        <select
                          aria-label={t(`Jumlah ${item.name}`, `${item.name} quantity`)}
                          value={selectedItems[itemId]}
                          onChange={(event) => updateItemQuantity(itemId, event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {Array.from(
                            { length: Math.max(1, Number(item.qty || 1)) },
                            (_, quantityIndex) => quantityIndex + 1
                          ).map((quantity) => (
                            <option key={quantity} value={quantity}>
                              {t("Jumlah", "Qty")} {quantity}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="customer-return-fields">
              <div className="customer-return-field">
                <label htmlFor={`return-issue-${order.id}`}>
                  {t("2. Jenis masalah", "2. Issue type")}
                </label>
                <select
                  id={`return-issue-${order.id}`}
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                >
                  {RETURN_ISSUE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === "en" ? option.en : option.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="customer-return-field full">
                <label htmlFor={`return-description-${order.id}`}>
                  {t("3. Jelaskan masalah", "3. Describe the problem")}
                </label>
                <textarea
                  id={`return-description-${order.id}`}
                  value={description}
                  maxLength={1500}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t(
                    "Contoh: tutup botol pecah saat paket dibuka dan isi produk bocor...",
                    "Example: the bottle cap was broken when the parcel was opened..."
                  )}
                />
                <small>{description.length}/1500</small>
              </div>
            </div>

            <div className="customer-return-block">
              <h4>{t("4. Solusi yang diharapkan", "4. Preferred resolution")}</h4>
              <div className="customer-return-resolution-grid">
                {RETURN_RESOLUTION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`customer-return-resolution ${requestedResolution === option.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`return-resolution-${order.id}`}
                      value={option.value}
                      checked={requestedResolution === option.value}
                      onChange={() => setRequestedResolution(option.value)}
                    />
                    <span>{locale === "en" ? option.en : option.id}</span>
                  </label>
                ))}
              </div>
              <p>
                {t(
                  "Pilihan ini adalah permintaan awal. Keputusan akhir mengikuti hasil pemeriksaan admin.",
                  "This is your preference. The final outcome depends on admin review."
                )}
              </p>
            </div>

            <div className="customer-return-block">
              <h4>{t("5. Foto bukti", "5. Evidence photos")}</h4>
              <p>
                {t(
                  "Unggah 1–3 foto produk, kemasan, atau bagian yang bermasalah. Maksimal 2 MB per foto.",
                  "Upload 1–3 photos of the product, packaging, or issue. Maximum 2 MB each."
                )}
              </p>
              <div className="customer-return-file-box">
                <label className="customer-return-file-trigger">
                  <ImagePlus size={14} />
                  {t("Pilih foto", "Choose photos")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => {
                      const result = fileValidation(event.target.files);
                      setEvidenceFiles(result.files);
                      setFeedback(result.error);
                    }}
                  />
                </label>
                {evidenceFiles.length > 0 && (
                  <ul className="customer-return-file-list">
                    {evidenceFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <label className="customer-return-policy">
              <input
                type="checkbox"
                checked={policyAccepted}
                onChange={(event) => setPolicyAccepted(event.target.checked)}
              />
              <span>
                {t(
                  "Data yang saya isi benar. Saya memahami produk tidak boleh dikirim balik sebelum ada persetujuan admin, dan retur tidak berlaku karena berubah pikiran atau salah memilih.",
                  "The information is accurate. I understand that no item may be returned before admin approval, and returns are not available for change of mind or choosing the wrong product."
                )}
              </span>
            </label>

            {feedback && <p className="customer-return-feedback">{feedback}</p>}
            {success && <p className="customer-return-feedback success">{success}</p>}

            <div className="customer-return-actions">
              <button
                type="button"
                className="customer-return-secondary"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                className="customer-return-primary"
                onClick={submitRequest}
                disabled={submitting}
              >
                {submitting
                  ? t("Mengirim...", "Submitting...")
                  : t("Kirim pengajuan", "Submit claim")}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="customer-return-panel">
      <style>{RETURN_PANEL_STYLES}</style>
      <div className="customer-return-status-head">
        <div className="customer-return-title">
          <span className="customer-return-icon">
            {request.status === "completed" ? (
              <CheckCircle2 size={18} />
            ) : request.status === "return_in_transit" ? (
              <Truck size={18} />
            ) : (
              <RotateCcw size={18} />
            )}
          </span>
          <div>
            <h3>{t("Komplain & retur", "Claim & return")}</h3>
            <span className="customer-return-status-id">{request.id}</span>
          </div>
        </div>
        <span
          className="customer-return-status-pill"
          style={{
            color: requestMeta.color,
            background: requestMeta.tone,
          }}
        >
          {requestMeta.label}
        </span>
      </div>

      <div className="customer-return-status-body">
        <div className="customer-return-summary-grid">
          <div>
            <small>{t("MASALAH", "ISSUE")}</small>
            <b>{getReturnIssueLabel(request.issueType, locale)}</b>
          </div>
          <div>
            <small>{t("PERMINTAAN", "REQUESTED")}</small>
            <b>
              {getReturnResolutionLabel(request.resolution || request.requestedResolution, locale)}
            </b>
          </div>
        </div>

        {request.latestAdminMessage && (
          <div className="customer-return-message">
            <small>{t("PESAN DARI ADMIN", "MESSAGE FROM ADMIN")}</small>
            <p>{request.latestAdminMessage}</p>
          </div>
        )}

        <div className="customer-return-block">
          <h4>{t("Produk yang diajukan", "Claimed items")}</h4>
          <div className="customer-return-product-list">
            {(request.selectedItems || []).map((item) => (
              <div key={item.id}>
                <span>
                  {item.name} × {item.qty}
                </span>
                <b>{formatIDR(Number(item.claimedAmount || 0))}</b>
              </div>
            ))}
          </div>
        </div>

        {request.evidence?.length > 0 && (
          <div className="customer-return-block">
            <h4>{t("Bukti yang dikirim", "Submitted evidence")}</h4>
            <div className="customer-return-evidence-grid">
              {request.evidence.map((item, index) => {
                const url = resolveReturnEvidenceUrl(item.url, API_BASE);
                return (
                  <a
                    key={`${item.url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={url}
                      alt={t(`Bukti komplain ${index + 1}`, `Claim evidence ${index + 1}`)}
                      loading="lazy"
                    />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {request.status === "waiting_customer" && (
          <div className="customer-return-followup">
            <h4>{t("Tambahkan jawaban atau bukti", "Add a response or evidence")}</h4>
            <p>
              {t(
                "Jawab permintaan admin di atas. Pengajuan akan kembali masuk antrean pemeriksaan.",
                "Respond to the admin request above. Your claim will return to the review queue."
              )}
            </p>
            <div className="customer-return-field">
              <textarea
                value={reply}
                maxLength={1000}
                onChange={(event) => setReply(event.target.value)}
                placeholder={t("Tulis jawaban tambahan...", "Write your additional response...")}
              />
            </div>
            {maxReplyFiles > 0 && (
              <div className="customer-return-file-box">
                <label className="customer-return-file-trigger">
                  <ImagePlus size={14} />
                  {t("Tambah bukti", "Add evidence")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => {
                      const result = fileValidation(event.target.files, maxReplyFiles);
                      setReplyFiles(result.files);
                      setFeedback(result.error);
                    }}
                  />
                </label>
                {replyFiles.length > 0 && (
                  <ul className="customer-return-file-list">
                    {replyFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>{file.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="customer-return-actions">
              <button
                type="button"
                className="customer-return-primary"
                onClick={submitReply}
                disabled={replying}
              >
                {replying ? t("Mengirim...", "Sending...") : t("Kirim jawaban", "Send response")}
              </button>
            </div>
          </div>
        )}

        {request.status === "approved" && request.returnRequired && (
          <div className="customer-return-followup">
            <h4>{t("Kirim barang retur", "Send the return")}</h4>
            <p>
              {request.returnInstructions ||
                t(
                  "Ikuti instruksi admin sebelum mengirim barang.",
                  "Follow the admin instructions before sending the item."
                )}
            </p>
            <div className="customer-return-fields">
              <div className="customer-return-field">
                <label htmlFor={`return-courier-${order.id}`}>{t("Kurir", "Courier")}</label>
                <input
                  id={`return-courier-${order.id}`}
                  value={shippingCourier}
                  maxLength={50}
                  onChange={(event) => setShippingCourier(event.target.value)}
                  placeholder="JNE / J&T / SiCepat"
                />
              </div>
              <div className="customer-return-field">
                <label htmlFor={`return-tracking-${order.id}`}>
                  {t("Nomor resi", "Tracking number")}
                </label>
                <input
                  id={`return-tracking-${order.id}`}
                  value={shippingTracking}
                  maxLength={100}
                  onChange={(event) => setShippingTracking(event.target.value)}
                  placeholder={t("Masukkan resi retur", "Enter return tracking")}
                />
              </div>
            </div>
            <div className="customer-return-actions">
              <button
                type="button"
                className="customer-return-primary"
                onClick={submitShipment}
                disabled={savingShipment}
              >
                {savingShipment
                  ? t("Menyimpan...", "Saving...")
                  : t("Simpan data pengiriman", "Save shipment")}
              </button>
            </div>
          </div>
        )}

        {request.status === "approved" && !request.returnRequired && (
          <div className="customer-return-message">
            <small>{t("TAHAP BERIKUTNYA", "NEXT STEP")}</small>
            <p>
              {t(
                "Tidak perlu mengirim barang kembali. Tim akan memproses keputusan yang telah disetujui.",
                "You do not need to send the item back. The team will process the approved resolution."
              )}
            </p>
          </div>
        )}

        {request.status === "return_in_transit" && request.returnShipment && (
          <div className="customer-return-message">
            <small>{t("PENGIRIMAN RETUR", "RETURN SHIPMENT")}</small>
            <p>
              {request.returnShipment.courier} · {request.returnShipment.trackingNumber}
            </p>
          </div>
        )}

        {request.status === "completed" && (
          <div className="customer-return-message">
            <small>{t("PENYELESAIAN", "RESOLUTION")}</small>
            <p>
              {request.resolution === "refund"
                ? t(
                    `Refund ${formatIDR(Number(request.refundAmount || 0))} telah dicatat. Referensi: ${request.refundReference || "-"}.`,
                    `A ${formatIDR(Number(request.refundAmount || 0))} refund was recorded. Reference: ${request.refundReference || "-"}.`
                  )
                : t(
                    `Barang pengganti telah dikirim. Resi: ${request.replacementTracking || "-"}.`,
                    `The replacement has been sent. Tracking: ${request.replacementTracking || "-"}.`
                  )}
            </p>
          </div>
        )}

        {(feedback || success) && (
          <p className={`customer-return-feedback ${success ? "success" : ""}`}>
            {success || feedback}
          </p>
        )}

        <div className="customer-return-block">
          <h4>{t("Riwayat pengajuan", "Claim history")}</h4>
          <div className="customer-return-timeline">
            {(request.statusHistory || [])
              .slice()
              .reverse()
              .map((entry, index) => {
                const meta = getReturnStatusMeta(entry.status, locale);
                return (
                  <div
                    key={`${entry.status}-${entry.at}-${index}`}
                    className="customer-return-history-row"
                  >
                    <div className="customer-return-history-marker">
                      <span style={{ background: meta.color }} />
                    </div>
                    <div className="customer-return-history-copy">
                      <b>{meta.label}</b>
                      {entry.note && <p>{entry.note}</p>}
                      <time>{formatReturnDate(entry.at, locale)}</time>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="customer-return-expired">
          {request.status === "rejected" ? (
            <AlertTriangle size={15} />
          ) : request.status === "completed" ? (
            <PackageCheck size={15} />
          ) : (
            <ShieldCheck size={15} />
          )}
          <span>
            {t(
              "Jangan mengirim barang kembali sebelum status disetujui dan instruksi retur tampil di halaman ini.",
              "Do not send anything back until the claim is approved and return instructions appear here."
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

export { ReturnRequestPanel };
