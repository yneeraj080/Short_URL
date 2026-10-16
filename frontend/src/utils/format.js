import { API_BASE_URL } from "../api/axios";

export const shortUrlFor = (code) => `${API_BASE_URL}/${code}`;

// Host shown in front of slugs, e.g. "localhost:5000/"
export const SHORT_HOST = API_BASE_URL.replace(/^https?:\/\//, "");

export const isExpired = (expiresAt) =>
  Boolean(expiresAt) && new Date(expiresAt) <= new Date();

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const formatNumber = (n) => (n || 0).toLocaleString();

// "in 12 days", "3 days ago", "today"
export const relativeDays = (value) => {
  if (!value) return "";
  const days = Math.round((new Date(value) - new Date()) / 86400000);
  if (days === 0) return "today";
  return days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${-days} day${days === -1 ? "" : "s"} ago`;
};

export const apiError = (err, fallback = "Something went wrong") =>
  err.response?.data?.error ||
  err.response?.data?.errors?.[0]?.msg ||
  (err.request && !err.response ? "Can't reach the server. Is the backend running?" : fallback);
