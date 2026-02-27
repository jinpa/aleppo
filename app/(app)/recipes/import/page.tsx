import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ImportFlow } from "@/components/recipes/import-flow";

export const metadata = { title: "Import Recipe" };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return <ImportFlow />;
}
