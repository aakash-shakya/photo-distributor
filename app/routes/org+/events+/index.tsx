import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";
import type { Event } from "@prisma/client"; // Import Event type

export const meta: MetaFunction = () => {
  return [{ title: "Manage Events" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Find the organization the user belongs to (assuming one org per user for now)
  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId: user.id },
    select: { orgId: true },
  });

  if (!orgUser) {
    // Handle case where user is not associated with an organization
    // This might involve redirecting or showing an error
    throw new Response("User not associated with an organization", { status: 403 });
  }

  const events = await prisma.event.findMany({
    where: { orgId: orgUser.orgId },
    orderBy: { dateStart: "desc" },
    // Select only necessary fields
    select: {
      id: true,
      name: true,
      dateStart: true,
      status: true,
    }
  });

  return json({ events });
}

export default function EventsIndex() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Events</h1>
        <Link
          to="new"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Create New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300">No events found.</p>
      ) : (
        <div className="overflow-x-auto rounded bg-white shadow dark:bg-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Start Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {events.map((event: Event) => ( // Explicitly type event
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{event.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {new Date(event.dateStart).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{event.status}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link to={`${event.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                      View
                    </Link>
                    {/* Add Edit/Delete links later */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
