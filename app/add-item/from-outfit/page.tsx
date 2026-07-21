import { requireOnboarded } from "@/lib/auth";
import AddFromOutfitClient from "@/components/AddFromOutfitClient";

export const dynamic = "force-dynamic";

export default async function AddFromOutfitPage() {
  await requireOnboarded();
  return <AddFromOutfitClient />;
}
