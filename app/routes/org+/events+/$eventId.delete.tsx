import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  invariant(params.eventId, "Missing eventId param");

  // Ensure the request method is POST (or DELETE if preferred, but forms typically use POST)
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, { status: 405 });
  }

  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId: user.id },
    select: { orgId: true },
  });

  if (!orgUser) {
    // This should ideally not happen if page access is controlled, but good practice
    return json({ message: "User not associated with an organization" }, { status: 403 });
  }

  try {
    // Verify the event exists and belongs to the user's organization before deleting
    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        orgId: orgUser.orgId,
      },
      select: { id: true }, // Only need the ID to confirm existence and ownership
    });

    if (!event) {
      // Event not found or user doesn't have permission
      return json({ message: "Event not found or access denied" }, { status: 404 });
    }

    // Delete the event
    await prisma.event.delete({
      where: {
        id: params.eventId,
        // Including orgId again for safety, though covered by the check above
        orgId: orgUser.orgId,
      },
    });

    // Redirect to the events list page after successful deletion
    return redirect("/org/events");

  } catch (error) {
    console.error("Failed to delete event:", error);
    // Generic error for the user
    return json({ message: "Failed to delete event. Please try again." }, { status: 500 });
  }
}

// No loader or default component needed for an action-only route
export function loader() {
    throw new Response("Not Found", { status: 404 });
}
export default function DeleteEventAction() {
    // This component should not be rendered. The action handles the request.
    return null;
}
