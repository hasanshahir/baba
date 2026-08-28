import Link from "next/link";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-2xl font-bold text-emerald-700">
          guftagu.ai <span className="font-urdu text-xl">گفتگو</span>
        </p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900">
          Create your business account
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Urdu-first AI support, grounded only in your own documents.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signup} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Business name
          </label>
          <input
            required
            name="company_name"
            placeholder="e.g. Karachi Electronics Store"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Escalation email
          </label>
          <input
            required
            type="email"
            name="escalation_email"
            placeholder="support@yourbusiness.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          <p className="mt-1 text-xs text-gray-500">
            We email you here when the AI can&apos;t confidently answer a
            customer.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Login email
          </label>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            required
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
