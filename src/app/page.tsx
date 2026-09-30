import { redirect } from "next/navigation";

/** The home URL simply forwards to the dashboard (middleware bounces
 *  logged-out visitors to /login automatically). */
export default function HomePage() {
  redirect("/dashboard");
}
