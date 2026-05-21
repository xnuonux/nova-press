import { PlateShell } from "@/components/editor/plate-shell";
import { PartnerRail } from "@/components/editor/partner-rail";

export const metadata = {
  title: "writing room · nova press",
};

export default function EditorPage() {
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <PlateShell initialTitle="untitled" />
      <PartnerRail />
    </main>
  );
}
