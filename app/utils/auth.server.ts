import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import type { User, Role } from "@prisma/client";

/**
 * Requires a user to be authenticated. Redirects to /login if not.
 * Optionally requires specific roles.
 */
export async function requireUser(
  request: Request,
  options?: {
    redirectTo?: string;
    requiredRoles?: Role[];
  }
): Promise<User> {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: options?.redirectTo ?? "/login",
  });

  if (options?.requiredRoles && !options.requiredRoles.includes(user.role)) {
    // Redirect to a suitable page if role doesn't match, e.g., dashboard or unauthorized page
    // For simplicity, redirecting to login for now.
    throw redirect(options?.redirectTo ?? "/login");
  }

  return user;
}

/**
 * Gets the current user from the session, if any.
 */
export async function getUser(request: Request): Promise<User | null> {
  return authenticator.isAuthenticated(request);
}
