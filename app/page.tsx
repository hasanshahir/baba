import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold text-emerald-700">
            guftagu.ai <span className="font-urdu text-lg">گفتگو</span>
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-gray-700 hover:text-emerald-700">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="font-urdu text-3xl text-emerald-700">
            آپ کے گاہکوں سے، ان کی اپنی زبان میں گفتگو
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            AI customer support in Urdu &amp; Roman Urdu — grounded only in{" "}
            <span className="text-emerald-700">your</span> documents
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            Upload your FAQs and policies. Embed a one-line chat widget on your
            website. Your customers ask questions in Urdu or Roman Urdu and get
            answers strictly from your own content — never invented. If the AI
            isn&apos;t sure, you get an email instead of a wrong answer.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              Create your widget
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Sign in
            </Link>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-6 text-left sm:grid-cols-3">
            {[
              {
                title: "Grounded answers (RAG)",
                body: "Every answer is generated only from retrieved chunks of your uploaded documents. The model is instructed to say “I don't know” rather than guess.",
              },
              {
                title: "Urdu & Roman Urdu",
                body: "Multilingual embeddings and language-matched replies — customers type in اردو or 'aap ki dukaan kab khulti hai' and both work.",
              },
              {
                title: "Human escalation",
                body: "Low-confidence answers flag the conversation and email you the full transcript, so customers are never left stranded.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 p-5"
              >
                <p className="font-semibold text-gray-900">{f.title}</p>
                <p className="mt-2 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        guftagu.ai — گفتگو کروائیں، اعتماد جیتیں
      </footer>
    </div>
  );
}
