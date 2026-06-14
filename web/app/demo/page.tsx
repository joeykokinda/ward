import { redirect } from "next/navigation";

// The cinematic now lives inline on the homepage ("See it run"). Keep /demo as a
// permanent handoff so older links (README, video script, slides) still resolve.
export default function DemoPage() {
  redirect("/#see-it-run");
}
