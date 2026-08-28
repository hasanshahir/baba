import Link from "next/link";
import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-2xl font-bold text-emerald-700">
          guftagu.ai <span className="font-urdu text-xl">گفتگو</span>
        </p>
        <h1 className="mt-2 text-lg font-semibold text-gray-900">
          Sign in to your business account
        </h1>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
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
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-emerald-700 hover:underline"
        >
          Create a business account
        </Link>
      </p>
    </div>
  );
}
