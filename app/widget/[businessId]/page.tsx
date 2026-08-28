import { createAdminClient } from "@/lib/supabase/admin";
import WidgetChat from "./widget-chat";

export const dynamic = "force-dynamic";

// Hosted widget page, iframed into business websites by public/widget.js.
// Public route (excluded from the auth proxy): no login required.
export default async function WidgetPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let companyName: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: business } = await admin
      .from("businesses")
      .select("company_name")
      .eq("id", businessId)
      .single();
    companyName = business?.company_name ?? null;
  } catch {
    companyName = null;
  }

  if (!companyName) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          This widget is not configured. (unknown business id)
        </p>
      </div>
    );
  }

  return <WidgetChat businessId={businessId} companyName={companyName} />;
}
