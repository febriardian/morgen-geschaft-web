// adminUtils.js
// Pure utility functions extracted from AdminPanel.jsx for reusability and testability.

export const ADMIN_SETTLED_STATUSES = ["paid", "processing", "shipped", "delivered"];

export function adminDashboardRange(period, customFrom, customTo) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  let start = new Date(startToday);
  let end = new Date(now);

  if (period === "7" || period === "30" || period === "90") {
    start.setDate(start.getDate() - (Number(period) - 1));
  } else if (period === "custom" && customFrom && customTo) {
    const parsedStart = new Date(`${customFrom}T00:00:00`);
    const parsedEnd = new Date(`${customTo}T23:59:59.999`);
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime()) && parsedStart <= parsedEnd) {
      start = parsedStart;
      end = parsedEnd;
    }
  }

  const duration = Math.max(60 * 60 * 1000, end.getTime() - start.getTime());
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start, end, previousStart, previousEnd };
}

export function adminDashboardDateLabel(date) {
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function adminCompactCurrency(value) {
  const number = Number(value || 0);
  if (number === 0) return "Rp0";
  return `Rp${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(number)}`;
}

export function adminTrend(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (previousValue === 0) {
    return currentValue > 0
      ? { label: "Periode awal", tone: "neutral" }
      : { label: "Belum ada perubahan", tone: "neutral" };
  }
  const percentage = Math.round(((currentValue - previousValue) / previousValue) * 100);
  return {
    label: `${percentage >= 0 ? "Naik" : "Turun"} ${Math.abs(percentage)}% dari periode sebelumnya`,
    tone: percentage > 0 ? "positive" : percentage < 0 ? "negative" : "neutral",
  };
}

export function buildAdminSalesSeries(orders, start, end, period) {
  const paidOrders = orders.filter((order) => ADMIN_SETTLED_STATUSES.includes(order.status));
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  if (period === "today") {
    return Array.from({ length: 6 }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setHours(index * 4, 0, 0, 0);
      const bucketEnd = new Date(start);
      bucketEnd.setHours((index + 1) * 4, 0, 0, 0);
      const label = `${String(index * 4).padStart(2, "0")}:00`;
      const revenue = paidOrders
        .filter((order) => {
          const t = new Date(order.createdAt).getTime();
          return t >= bucketStart.getTime() && t < bucketEnd.getTime();
        })
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
      return { label, revenue };
    });
  }

  const bucketCount = totalDays <= 7 ? totalDays : totalDays <= 31 ? 7 : 10;
  const bucketSize = totalDays / bucketCount;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * bucketSize * 86400000);
    const bucketEnd = new Date(start.getTime() + (index + 1) * bucketSize * 86400000);
    const label = adminDashboardDateLabel(bucketStart);
    const revenue = paidOrders
      .filter((order) => {
        const t = new Date(order.createdAt).getTime();
        return t >= bucketStart.getTime() && t < bucketEnd.getTime();
      })
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { label, revenue };
  });
}
