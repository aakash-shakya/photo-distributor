import { Outlet, Link, useParams, useLoaderData } from "@remix-run/react";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";

// Loader to fetch event name for breadcrumbs
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request); // Ensure user is logged in
  invariant(params.eventId, "Missing eventId param");

  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId: user.id },
    select: { orgId: true },
  });

  if (!orgUser) {
    throw new Response("User not associated with an organization", { status: 403 });
  }

  // Fetch the actual event name, ensuring it belongs to the user's org
  const event = await prisma.event.findFirst({
    where: {
        id: params.eventId,
        orgId: orgUser.orgId
    },
    select: { name: true }
  });

  if (!event) {
    throw new Response("Event not found or access denied", { status: 404 });
  }

  return json({ eventName: event.name });
}


export default function ParticipantsLayout() {
  const params = useParams();
  const { eventName } = useLoaderData<typeof loader>(); // Use actual loader data

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="mb-4 text-sm" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/org/events" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
              Events
            </Link>
          </li>
           <li className="inline-flex items-center">
             <svg className="mx-1 h-3 w-3 text-gray-400 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
            <Link to={`/org/events/${params.eventId}`} className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
              {eventName} {/* Display actual event name */}
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg className="mx-1 h-3 w-3 text-gray-400 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <span className="ms-1 text-sm font-medium text-gray-500 dark:text-gray-400 md:ms-2">Participants</span>
            </div>
          </li>
        </ol>
      </nav>

      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Manage Participants</h1>

      {/* Removed placeholder warning about DB limits */}

      {/* Outlet for nested routes (index, new, $participantId) */}
      <Outlet />
    </div>
  );
}
