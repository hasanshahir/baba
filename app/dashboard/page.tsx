import { redirect } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import DocumentsSection from "./documents-section";
import EmbedSnippet from "./embed-snippet";
import ChatsSection from "./chats-section";

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

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your knowledge base, widget, and customer conversations.
          </p>
        </div>

        <EmbedSnippet businessId={user.id} />
        <DocumentsSection />
        <ChatsSection />

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
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
