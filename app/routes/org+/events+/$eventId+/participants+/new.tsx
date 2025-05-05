import { Form, Link, useParams, useActionData, redirect, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUser } from "~/utils/auth.server";
import invariant from "tiny-invariant";
import { prisma } from "~/db.server"; // Import prisma
import { z } from "zod"; // For validation

// Schema for validation
const ParticipantSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    // Add other fields as needed (e.g., registrationStatus, consentStatus)
});

// Action to handle actual participant creation
export async function action({ request, params }: ActionFunctionArgs) {
    const user = await requireUser(request);
    invariant(params.eventId, "Missing eventId param");

    const orgUser = await prisma.organizationUser.findFirst({
        where: { userId: user.id },
        select: { orgId: true },
    });

    if (!orgUser) {
        return json({ errors: { form: "User not associated with an organization" } }, { status: 403 });
    }

    // Verify event ownership before adding participant
    const event = await prisma.event.findFirst({
        where: { id: params.eventId, orgId: orgUser.orgId },
        select: { id: true },
    });

    if (!event) {
        return json({ errors: { form: "Event not found or access denied" } }, { status: 404 });
    }

    const formData = await request.formData();
    const submission = ParticipantSchema.safeParse(Object.fromEntries(formData));

    // Validate form data
    if (!submission.success) {
        return json({ errors: submission.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, email } = submission.data;

    try {
        // Check if participant with this email already exists for this event
        const existingParticipant = await prisma.participant.findFirst({
            where: {
                eventId: params.eventId,
                email: email,
            }
        });

        if (existingParticipant) {
            return json({ errors: { email: "A participant with this email already exists for this event." } }, { status: 400 });
        }

        // Create the participant record
        await prisma.participant.create({
            data: {
                eventId: params.eventId,
                name: name,
                email: email,
                // Set defaults for other fields
                registrationStatus: 'Invited', // Default status
                consentStatus: false, // Default consent
                // userId: null, // Link later if they register
                // referencePhotoUrl: null,
            }
        });

        // Redirect back to the participants list on success
        return redirect(`/org/events/${params.eventId}/participants`);

    } catch (error) {
        console.error("Failed to add participant:", error);
        // Handle potential database errors (e.g., unique constraint if validation missed something)
        return json({ errors: { form: "Failed to add participant. Please try again later." } }, { status: 500 });
    }
}


export default function NewParticipantPage() {
  const params = useParams();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get('_action') === 'createParticipant';


  return (
    <div className="rounded bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Add New Participant</h2>

       {/* Display general form errors */}
       {actionData?.errors?.form && (
            <div className="mb-4 rounded-md bg-red-50 p-4 dark:bg-red-900">
                 <p className="text-sm font-medium text-red-800 dark:text-red-200">{actionData.errors.form}</p>
            </div>
        )}


      <Form method="post">
         {/* Add hidden field if needed for multiple actions on the same route */}
         {/* <input type="hidden" name="_action" value="createParticipant" /> */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              aria-invalid={actionData?.errors?.name ? true : undefined}
              aria-describedby="name-error"
            />
             {actionData?.errors?.name && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" id="name-error">
                    {actionData.errors.name}
                </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
               aria-invalid={actionData?.errors?.email ? true : undefined}
              aria-describedby="email-error"
            />
             {actionData?.errors?.email && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" id="email-error">
                    {actionData.errors.email}
                </p>
            )}
          </div>

          {/* Add fields for Reference Photo URL, Consent Status later */}
           {/* <div className="text-xs text-gray-500 dark:text-gray-400">
                More fields (e.g., reference photo, initial status) will be available once database functionality is restored.
           </div> */}

        </div>

        <div className="mt-6 flex items-center justify-end space-x-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Link
            to={`/org/events/${params.eventId}/participants`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add Participant"}
          </button>
        </div>
      </Form>
    </div>
  );
}
