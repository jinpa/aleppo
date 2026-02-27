import { auth } from "@/auth";
import { Nav } from "@/components/layout/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-stone-50">
      <Nav session={session} />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>
    </div>
  );
}
