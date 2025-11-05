import { redirect } from "next/navigation";

export default function Home() {
  // No landing page; send users to the compare view
  redirect("/compare");
}
