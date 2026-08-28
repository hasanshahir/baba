"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    redirect("/login?error=Email and password are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signup(formData: FormData) {
  const companyName = String(formData.get("company_name") ?? "").trim();
  const escalationEmail = String(formData.get("escalation_email") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!companyName || !email || !password || !escalationEmail) {
    redirect("/signup?error=All fields are required.");
  }
  if (password.length < 8) {
    redirect("/signup?error=Password must be at least 8 characters.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { company_name: companyName },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // With email confirmation disabled the session exists immediately and we can
  // create the business profile row now (service role: user row may not have
  // an active session context yet).
  if (data.user) {
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("businesses").upsert({
      id: data.user.id,
      company_name: companyName,
      escalation_email: escalationEmail,
    });
    if (insertError) {
      redirect(
        `/signup?error=${encodeURIComponent(
          "Account created but profile setup failed: " + insertError.message
        )}`
      );
    }
  }

  // If Supabase email confirmation is enabled, tell the user to confirm first.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect(
      "/login?message=Check your inbox to confirm your email, then sign in."
    );
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
