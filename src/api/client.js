import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
  // baseURL: 'http://192.168.1.40:4000/api',
  timeout: 30000,
});

// 👇 paste the two interceptors here
api.interceptors.request.use((config) => {
  console.log(
    "➡️ REQUEST",
    config.method?.toUpperCase(),
    config.baseURL + config.url,
    config.data ?? "(no body)",
  );
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log("⬅️ RESPONSE", res.status, res.config.url, res.data);
    return res;
  },
  (err) => {
    console.error(
      "❌ ERROR",
      err.config?.url,
      err.response?.status,
      err.response?.data || err.message,
    );
    return Promise.reject(err);
  },
);

export async function fetchEmails() {
  const res = await api.get("/emails");
  return res.data;
}

export async function fetchEmailDetail(id) {
  const res = await api.get(`/email/${id}`);
  return res.data;
}

export async function fetchAttachments(id) {
  const res = await api.get(`/email/${id}/attachments`);
  return res.data;
}

export async function notifyN8n(id) {
  const res = await api.post(`/email/${id}/notify-n8n`);
  return res.data;
}

export default api;
