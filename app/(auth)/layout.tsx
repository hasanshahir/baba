export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-emerald-50/40 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
