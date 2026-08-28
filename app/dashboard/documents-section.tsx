"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DocumentRow {
  id: string;
  filename: string;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  error: string | null;
  created_at: string;
}

export default function DocumentsSection() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchDocuments(): Promise<DocumentRow[]> {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents ?? [];
  }

  const refresh = useCallback(async () => {
    const rows = await fetchDocuments();
    setDocuments(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchDocuments();
      if (cancelled) return;
      setDocuments(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Upload failed" });
      } else {
        setMessage({
          kind: "ok",
          text: `"${file.name}" processed — ${data.chunks} searchable chunk(s) indexed.`,
        });
      }
      await refresh();
    } catch {
      setMessage({ kind: "err", text: "Upload failed (network error)" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string, filename: string) {
    if (!confirm(`Delete "${filename}" and its indexed content?`)) return;
    const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ kind: "err", text: data.error ?? "Delete failed" });
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Knowledge documents</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload FAQs / policy docs (PDF or text). Customers&apos; answers come
            only from these.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
        />
        {uploading && (
          <span className="text-sm text-gray-500">
            Chunking, embedding &amp; indexing…
          </span>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            No documents yet — upload your first FAQ to activate the widget.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">File</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Chunks</th>
                <th className="py-2 pr-4">Uploaded</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="py-2.5 pr-4 font-medium text-gray-800">{d.filename}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.status === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : d.status === "processing"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                      }`}
                      title={d.error ?? undefined}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">{d.chunk_count}</td>
                  <td className="py-2.5 pr-4 text-gray-500">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => remove(d.id, d.filename)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
