import { useState, useEffect, useCallback } from "react";
import TopBar from "./components/TopBar";
import EmailSidebar from "./components/EmailSidebar";
import PdfViewer from "./components/PdfViewer";
import DeclarationPanel from "./components/DeclarationPanel";
import {
  fetchEmails,
  fetchEmailDetail,
  fetchAttachments,
  notifyN8n,
} from "./api/client";

const POLL_INTERVAL_MS = 5000;

export default function App() {
  const [emails, setEmails] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [lastSync, setLastSync] = useState("—");

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem("dismissedEmailIds");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activeId, setActiveId] = useState(null);
  const [activeEmail, setActiveEmail] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [declaration, setDeclaration] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadEmails = useCallback(async () => {
    try {
      const data = await fetchEmails();
      setEmails(data.results || []);
      setLastSync(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (err) {
      console.error("Failed to load emails", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEmails();
    const interval = setInterval(loadEmails, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadEmails]);

  const visibleEmails = emails.filter((e) => !dismissedIds.has(e.id));

  const selectEmail = useCallback(async (id) => {
    setActiveId(id);
    setDeclaration(null);
    setAttachments([]);
    setBusy(true);

    try {
      const [detail, atts] = await Promise.all([
        fetchEmailDetail(id),
        fetchAttachments(id),
      ]);
      setActiveEmail(detail);
      setAttachments(
        atts.map((a) => ({ ...a, url: `http://localhost:4000${a.url}` })),
      );
    } catch (err) {
      console.error("Failed to load email detail/attachments", err);
      setBusy(false);
      return;
    }

    try {
      const n8nResult = await notifyN8n(id);
      console.log("n8n raw response:", n8nResult);
      setDeclaration(n8nResult?.n8n_response || null);
    } catch (err) {
      console.error("n8n declaration extraction failed or timed out", err);
      setDeclaration(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const dismissEmail = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("dismissedEmailIds", JSON.stringify([...next]));
      return next;
    });
    setActiveId((current) => {
      if (current === id) {
        setActiveEmail(null);
        setAttachments([]);
        setDeclaration(null);
        return null;
      }
      return current;
    });
  }, []);

  const deselectEmail = useCallback(() => {
    setActiveId(null);
    setActiveEmail(null);
    setAttachments([]);
    setDeclaration(null);
  }, []);

  const saveDeclaration = useCallback(async (data) => {
    console.log("Saving declaration:", data);
  }, []);

  return (
    <div className="app-shell">
      <TopBar pendingCount={visibleEmails.length} lastSync={lastSync} />
      <div className="workspace">
        <EmailSidebar
          emails={visibleEmails}
          activeId={activeId}
          onSelect={selectEmail}
          onDismiss={dismissEmail}
          loading={loadingList}
        />
        <PdfViewer email={activeEmail} attachments={attachments} />
        <DeclarationPanel
          email={activeEmail}
          declaration={declaration}
          busy={busy}
          onSave={saveDeclaration}
          onDismissEmail={dismissEmail}
          onDeselectEmail={deselectEmail}
        />
      </div>
    </div>
  );
}
