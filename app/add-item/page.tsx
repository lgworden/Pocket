import { requireOnboarded } from "@/lib/auth";
import AddItemClient from "@/components/AddItemClient";

export const dynamic = "force-dynamic";

export default async function AddItemPage() {
  await requireOnboarded();
  return <AddItemClient />;
}
