"use client";

import { useMemo, useState } from "react";

export default function EmbedSnippet({ businessId }: { businessId: string }) {
  const [copied, setCopied] = useState(false);

  const { snippet, demoUrl } = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      snippet: `<script src="${origin}/widget.js" data-business="${businessId}" async></script>`,
      demoUrl: `/demo?bid=${encodeURIComponent(businessId)}`,
    };
  }, [businessId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Your chat widget</h2>
      <p className="mt-1 text-sm text-gray-500">
        Paste this one line anywhere on your website. Customers chat in Urdu /
        Roman Urdu; answers come only from your documents.
      </p>

      <div className="mt-4 flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 font-mono text-xs text-emerald-300">
          {snippet}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <a
          href={demoUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          Try it on the demo storefront ↗
        </a>
        <span className="text-xs text-gray-400">
          Business ID: <code className="font-mono">{businessId}</code>
        </span>
      </div>
    </section>
  );
}
