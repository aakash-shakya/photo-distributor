import { Link, useParams, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";
import invariant from "tiny-invariant";
import type { Participant } from "@prisma/client"; // Import Participant type

// Loader to fetch actual participants
export async function loader({ request, params }: LoaderFunctionArgs) {
    const user = await requireUser(request);
    invariant(params.eventId, "Missing eventId param");

     const orgUser = await prisma.organizationUser.findFirst({
        where: { userId: user.id },
        select: { orgId: true },
    });

    if (!orgUser) {
        throw new Response("User not associated with an organization", { status: 403 });
    }

    // Verify event ownership before fetching participants
    const event = await prisma.event.findFirst({
        where: { id: params.eventId, orgId: orgUser.orgId },
        select: { id: true },
    });

    if (!event) {
        throw new Response("Event not found or access denied", { status: 404 });
    }

    // Fetch actual participants for the event
    const participants = await prisma.participant.findMany({
        where: { eventId: params.eventId },
        orderBy: { createdAt: 'asc' },
        // Select necessary fields
        select: { id: true, name: true, email: true, registrationStatus: true, consentStatus: true }
    });

    return json({ participants });
}


export default function ParticipantsIndexPage() {
  const { participants } = useLoaderData<typeof loader>();
  const params = useParams();

  return (
    <div className="rounded bg-white p-6 shadow dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Participant List ({participants.length})</h2>
            <Link
                to="new"
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
                Add New Participant
            </Link>
         </div>

        {participants.length > 0 ? (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Consent</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {participants.map((participant: Participant) => ( // Use Participant type
                            <tr key={participant.id}>
                                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{participant.name || 'N/A'}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{participant.email || '-'}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{participant.registrationStatus || 'Unknown'}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                        participant.consentStatus
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                                    }`}>
                                        {participant.consentStatus ? 'Granted' : 'Pending/Revoked'}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                    {/* TODO: Implement View/Edit/Remove links/actions */}
                                    <Link to={`${participant.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">View</Link>
                                    <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                                     {/* TODO: Implement Remove action using Form/Fetcher */}
                                     <button type="button" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className="py-4 text-center text-gray-500 dark:text-gray-400">No participants found for this event.</p>
        )}
    </div>
  );
}
