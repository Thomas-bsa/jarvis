import { BilanChat } from "@/components/BilanChat";
import { hasGemini } from "@/lib/gemini";

export default async function Bilan({ searchParams }: PageProps<"/bilan">) {
  const { mode } = await searchParams;
  return <BilanChat initialMode={mode === "libre" ? "libre" : "bilan"} gemini={hasGemini()} />;
}
