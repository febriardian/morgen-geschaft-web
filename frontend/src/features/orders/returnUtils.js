const RETURN_STATUS_META = {
  submitted: {
    id: "Diajukan",
    en: "Submitted",
    color: "#F59A1A",
    tone: "#FFF5E5",
  },
  reviewing: {
    id: "Sedang ditinjau",
    en: "Under review",
    color: "#173B5E",
    tone: "#EEF4FA",
  },
  waiting_customer: {
    id: "Menunggu jawabanmu",
    en: "Waiting for your response",
    color: "#A86200",
    tone: "#FFF4DD",
  },
  approved: {
    id: "Disetujui",
    en: "Approved",
    color: "#2E6A4F",
    tone: "#EAF5EF",
  },
  return_in_transit: {
    id: "Retur sedang dikirim",
    en: "Return in transit",
    color: "#316F9E",
    tone: "#EAF4FB",
  },
  return_received: {
    id: "Retur diterima",
    en: "Return received",
    color: "#4C6354",
    tone: "#EEF2EA",
  },
  rejected: {
    id: "Tidak disetujui",
    en: "Not approved",
    color: "#A9573D",
    tone: "#FFF0EA",
  },
  completed: {
    id: "Selesai",
    en: "Completed",
    color: "#1F2E22",
    tone: "#E9F0EB",
  },
};

const RETURN_ISSUE_OPTIONS = [
  {
    value: "damaged_or_leaking",
    id: "Barang rusak atau bocor",
    en: "Damaged or leaking item",
  },
  {
    value: "wrong_item",
    id: "Produk yang dikirim salah",
    en: "Wrong item delivered",
  },
  {
    value: "missing_quantity",
    id: "Jumlah produk kurang",
    en: "Missing quantity",
  },
  {
    value: "expired_or_unfit",
    id: "Kedaluwarsa atau tidak layak",
    en: "Expired or unfit for use",
  },
  {
    value: "seller_error",
    id: "Kesalahan penjual lainnya",
    en: "Other seller error",
  },
];

const RETURN_RESOLUTION_OPTIONS = [
  {
    value: "replacement",
    id: "Penggantian barang",
    en: "Product replacement",
  },
  {
    value: "refund",
    id: "Refund",
    en: "Refund",
  },
];

function getReturnStatusMeta(status, locale = "id") {
  const meta = RETURN_STATUS_META[status] || {
    id: status || "Belum diketahui",
    en: status || "Unknown",
    color: "#6B6558",
    tone: "#F5F1EA",
  };
  return { ...meta, label: locale === "en" ? meta.en : meta.id };
}

function getReturnIssueLabel(value, locale = "id") {
  const option = RETURN_ISSUE_OPTIONS.find((item) => item.value === value);
  if (!option) return value || "-";
  return locale === "en" ? option.en : option.id;
}

function getReturnResolutionLabel(value, locale = "id") {
  const option = RETURN_RESOLUTION_OPTIONS.find((item) => item.value === value);
  if (!option) return value || "-";
  return locale === "en" ? option.en : option.id;
}

function resolveReturnEvidenceUrl(value, apiBase = "") {
  if (!value) return "";
  if (/^https:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  if (value.startsWith("/")) return apiBase ? `${apiBase}${value}` : value;
  return value;
}

export {
  RETURN_ISSUE_OPTIONS,
  RETURN_RESOLUTION_OPTIONS,
  RETURN_STATUS_META,
  getReturnIssueLabel,
  getReturnResolutionLabel,
  getReturnStatusMeta,
  resolveReturnEvidenceUrl,
};
