import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { authenticator } from "~/services/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: "/login" });
}

export async function loader() {
  // Redirect GET requests to the homepage or login page
  return redirect("/");
}
