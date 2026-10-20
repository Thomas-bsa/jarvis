import { NavBar } from "@/components/NavBar";
import { ServiceWorker } from "@/components/ServiceWorker";
import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <main className="safe-top mx-auto flex max-w-lg flex-col gap-4 px-5 pb-32">{children}</main>
      <NavBar />
      <ServiceWorker />
    </>
  );
}
