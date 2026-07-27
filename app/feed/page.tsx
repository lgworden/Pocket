import { redirect } from "next/navigation";

// Feed moved to "/" as part of the social-first pivot (see SOCIAL_PIVOT_PLAN.md).
// Kept as a redirect so old notification links and bookmarks still land somewhere.
export const dynamic = "force-dynamic";

export default function FeedRedirect() {
  redirect("/");
}
