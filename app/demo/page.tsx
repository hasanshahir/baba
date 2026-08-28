import Script from "next/script";

export const dynamic = "force-dynamic";

// A fake "business website" used to demo/test the embeddable widget, exactly as
// a real business would embed it: one script tag. Open /demo?bid=BUSINESS_ID.
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ bid?: string }>;
}) {
  const { bid } = await searchParams;

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-gray-900">
            Karachi Electronics Store
          </span>
          <span className="text-sm text-gray-500">Demo storefront</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">
          This page pretends to be a business&apos;s website
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          It embeds the guftagu.ai widget with a single script tag — the same
          snippet a real business would paste. The floating button in the corner
          opens the Urdu / Roman Urdu support chat.
        </p>

        {bid ? (
          <>
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Widget loaded for business <code className="font-mono">{bid}</code>.
              Click the chat button in the bottom-right corner.
            </div>
            <Script
              src="/widget.js"
              data-business={bid}
              strategy="afterInteractive"
            />
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No business id provided. Create an account to get one, then visit{" "}
            <code className="font-mono">/demo?bid=YOUR_BUSINESS_ID</code>.
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {["Laptops", "Mobiles", "Accessories"].map((c) => (
            <div key={c} className="rounded-xl border border-gray-200 p-6">
              <p className="font-medium text-gray-900">{c}</p>
              <p className="mt-1 text-sm text-gray-500">Sample category</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
