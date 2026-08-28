import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-700">
              guftagu.ai <span className="font-urdu">گفتگو</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">{business?.company_name}</span>
            <form action={logout}>
              <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Documents, widget setup and chat logs will live here — coming in the
          next build phases.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Documents", body: "Upload FAQs & policy docs" },
            { title: "Chat widget", body: "Embed snippet for your site" },
            { title: "Chat logs", body: "Conversations & escalations" },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <p className="font-medium text-gray-900">{card.title}</p>
              <p className="mt-1 text-sm text-gray-500">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          Signed in as <strong>{user.email}</strong>
          {business?.escalation_email && (
            <>
              {" "}
              — escalations go to <strong>{business.escalation_email}</strong>
            </>
          )}
          .
        </div>
      </main>
    </div>
  );
}
