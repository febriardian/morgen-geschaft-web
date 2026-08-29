#!/usr/bin/env bash
# firestore-backup.sh — Automated Firestore export to Cloud Storage
#
# PREREQUISITES:
#   1. gcloud CLI installed & authenticated
#   2. Service account with roles: Cloud Datastore Import Export Admin, Storage Admin
#   3. GCS bucket created: gs://YOUR_BUCKET_NAME
#
# USAGE:
#   ./firestore-backup.sh                     # backup semua collection
#   ./firestore-backup.sh products orders     # backup collection tertentu
#
# CRON (setiap hari jam 3 pagi):
#   0 3 * * * /path/to/firestore-backup.sh >> /var/log/firestore-backup.log 2>&1
#
# ALTERNATIVE: Jika tidak pakai gcloud, gunakan Firebase Admin SDK
#   node infra/scripts/firestore-backup-admin.js

set -euo pipefail

# ---------------------------------------------------------------------------
# CONFIG — sesuaikan dengan project kamu
# ---------------------------------------------------------------------------
PROJECT_ID="${GCLOUD_PROJECT_ID:-morgen-geschaft}"
BACKUP_BUCKET="${FIRESTORE_BACKUP_BUCKET:-}"
if [ -z "${BACKUP_BUCKET}" ]; then
  echo "ERROR: FIRESTORE_BACKUP_BUCKET belum diisi (contoh gs://morgen-geschaft-backups)." >&2
  exit 1
fi
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="${BACKUP_BUCKET}/firestore/${TIMESTAMP}"

# Collections yang penting untuk di-backup
# Kosongkan array untuk backup semua collections
DEFAULT_COLLECTIONS=("products" "orders" "coupons" "blogs" "reviews" "notifications" "push_subscriptions")

# Pakai argument jika ada, fallback ke default
if [ $# -gt 0 ]; then
  COLLECTIONS=("$@")
else
  COLLECTIONS=("${DEFAULT_COLLECTIONS[@]}")
fi

echo "======================================"
echo "Firestore Backup: ${TIMESTAMP}"
echo "Project: ${PROJECT_ID}"
echo "Destination: ${BACKUP_PATH}"
echo "Collections: ${COLLECTIONS[*]}"
echo "======================================"

# Build comma-separated collection list for --collection-ids.
COLLECTION_LIST=$(IFS=,; echo "${COLLECTIONS[*]}")

# Run export
gcloud firestore export "${BACKUP_PATH}" \
  --project="${PROJECT_ID}" \
  --collection-ids="${COLLECTION_LIST}"

echo "Backup export completed successfully."

# ---------------------------------------------------------------------------
# CLEANUP — hapus backup lebih dari 30 hari
# ---------------------------------------------------------------------------
echo ""
echo "Cleaning up backups older than 30 days..."

# List dan hapus folder lama di GCS
CUTOFF_DATE=$(date -d "30 days ago" +%Y%m%d 2>/dev/null || date -v-30d +%Y%m%d 2>/dev/null || echo "")

if [ -n "${CUTOFF_DATE}" ]; then
  gcloud storage ls "${BACKUP_BUCKET}/firestore/" 2>/dev/null | while read -r backup_dir; do
    # Extract date from path (format: YYYYMMDD-HHMMSS)
    dir_date=$(basename "${backup_dir}" | cut -d'-' -f1)
    if [ "${dir_date}" -lt "${CUTOFF_DATE}" ] 2>/dev/null; then
      echo "  Removing old backup: ${backup_dir}"
      gcloud storage rm --recursive "${backup_dir}" --quiet 2>/dev/null || true
    fi
  done
  echo "Cleanup done."
else
  echo "  Skipped cleanup (date command incompatible)."
fi

echo ""
echo "Backup process complete."
