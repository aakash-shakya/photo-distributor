import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";
import invariant from "tiny-invariant";
import { format } from 'date-fns'; // For formatting date input
import { EventStatus } from "@prisma/client"; // Import enum

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const eventName = data?.event?.name ?? "Edit Event";
  return [{ title: `Edit ${eventName}` }];
};

// Enhanced Schema for validation
const EventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  dateStart: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date",
  }),
  dateEnd: z.string().optional().nullable().refine((date) => !date || !isNaN(Date.parse(date)), {
    message: "Invalid end date",
  }),
  description: z.string().optional().nullable(),
  locationName: z.string().optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  status: z.nativeEnum(EventStatus), // Use the enum from Prisma
  isPublic: z.preprocess((val) => val === 'on' || val === true, z.boolean()), // Handle checkbox value
});

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

  const event = await prisma.event.findUnique({
    where: {
      id: params.eventId,
      orgId: orgUser.orgId, // Ensure user can only edit events in their org
    },
  });

  if (!event) {
    throw new Response("Event not found or access denied", { status: 404 });
  }

  // Format dates for input fields default value
  const formattedEvent = {
    ...event,
    dateStart: format(new Date(event.dateStart), 'yyyy-MM-dd'), // Format for <input type="date">
    dateEnd: event.dateEnd ? format(new Date(event.dateEnd), 'yyyy-MM-dd') : null, // Format end date if it exists
    // Ensure nulls are handled for optional fields if needed by the form
    description: event.description ?? '',
    locationName: event.locationName ?? '',
    locationAddress: event.locationAddress ?? '',
  };

  return json({ event: formattedEvent, eventStatuses: Object.values(EventStatus) }); // Pass statuses for dropdown
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  invariant(params.eventId, "Missing eventId param");
  const formData = await request.formData();
  const formPayload = Object.fromEntries(formData);

  const orgUser = await prisma.organizationUser.findFirst({
    where: { userId: user.id },
    select: { orgId: true },
  });

  if (!orgUser) {
    return json({ errors: { form: "User not associated with an organization" } }, { status: 403 });
  }

  const result = EventSchema.safeParse(formPayload);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    // Return errors with the original form data to repopulate
    return json({ errors, values: formPayload }, { status: 400 });
  }

  try {
    // Check if the event exists and belongs to the user's org before updating
    const existingEvent = await prisma.event.findFirst({
        where: {
            id: params.eventId,
            orgId: orgUser.orgId,
        },
        select: { id: true } // Only need to confirm existence
    });

    if (!existingEvent) {
        throw new Response("Event not found or access denied", { status: 404 });
    }

    await prisma.event.update({
      where: {
        id: params.eventId,
      },
      data: {
        name: result.data.name,
        dateStart: new Date(result.data.dateStart),
        dateEnd: result.data.dateEnd ? new Date(result.data.dateEnd) : null, // Handle optional dateEnd
        description: result.data.description,
        locationName: result.data.locationName,
        locationAddress: result.data.locationAddress,
        status: result.data.status,
        isPublic: result.data.isPublic,
      },
    });
    // Redirect back to the event details page after successful update
    return redirect(`/org/events/${params.eventId}`);
  } catch (error) {
    console.error("Failed to update event:", error);
     if (error instanceof Response) { // Re-throw specific responses
        throw error;
    }
    // Ensure values are passed back correctly, especially the checkbox
    const returnValues = {
        ...formPayload,
        isPublic: formPayload.isPublic === 'on' // Ensure boolean state is reflected
    };
    return json({ errors: { form: "Failed to update event. Please try again." }, values: returnValues }, { status: 500 });
  }
}


export default function EditEventPage() {
  const { event, eventStatuses } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Use actionData values if available (on error), otherwise use loader data
  const currentValues = actionData?.values ?? event;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Edit Event: {event.name}</h1>
      <Form method="post" className="space-y-6 rounded bg-white p-6 shadow dark:bg-gray-800">
        {actionData?.errors?.form && (
          <p className="text-sm text-red-600">{actionData.errors.form}</p>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Event Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={currentValues.name}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.name ? true : undefined}
            aria-describedby="name-error"
          />
          {actionData?.errors?.name && (
            <p className="mt-1 text-sm text-red-600" id="name-error">
              {actionData.errors.name}
            </p>
          )}
        </div>

        {/* Start Date */}
        <div>
          <label htmlFor="dateStart" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Start Date
          </label>
          <input
            id="dateStart"
            name="dateStart"
            type="date"
            required
            defaultValue={currentValues.dateStart ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.dateStart ? true : undefined}
            aria-describedby="dateStart-error"
          />
           {actionData?.errors?.dateStart && (
            <p className="mt-1 text-sm text-red-600" id="dateStart-error">
              {actionData.errors.dateStart}
            </p>
          )}
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="dateEnd" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            End Date (Optional)
          </label>
          <input
            id="dateEnd"
            name="dateEnd"
            type="date"
            defaultValue={currentValues.dateEnd ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.dateEnd ? true : undefined}
            aria-describedby="dateEnd-error"
          />
           {actionData?.errors?.dateEnd && (
            <p className="mt-1 text-sm text-red-600" id="dateEnd-error">
              {actionData.errors.dateEnd}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={currentValues.description ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.description ? true : undefined}
            aria-describedby="description-error"
          />
          {actionData?.errors?.description && (
            <p className="mt-1 text-sm text-red-600" id="description-error">
              {actionData.errors.description}
            </p>
          )}
        </div>

        {/* Location Name */}
        <div>
          <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location Name
          </label>
          <input
            id="locationName"
            name="locationName"
            type="text"
            defaultValue={currentValues.locationName ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.locationName ? true : undefined}
            aria-describedby="locationName-error"
          />
          {actionData?.errors?.locationName && (
            <p className="mt-1 text-sm text-red-600" id="locationName-error">
              {actionData.errors.locationName}
            </p>
          )}
        </div>

        {/* Location Address */}
        <div>
          <label htmlFor="locationAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location Address
          </label>
          <input
            id="locationAddress"
            name="locationAddress"
            type="text"
            defaultValue={currentValues.locationAddress ?? ''}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.locationAddress ? true : undefined}
            aria-describedby="locationAddress-error"
          />
          {actionData?.errors?.locationAddress && (
            <p className="mt-1 text-sm text-red-600" id="locationAddress-error">
              {actionData.errors.locationAddress}
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={currentValues.status}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            aria-invalid={actionData?.errors?.status ? true : undefined}
            aria-describedby="status-error"
          >
            {eventStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {actionData?.errors?.status && (
            <p className="mt-1 text-sm text-red-600" id="status-error">
              {actionData.errors.status}
            </p>
          )}
        </div>

        {/* Is Public */}
        <div className="flex items-center">
          <input
            id="isPublic"
            name="isPublic"
            type="checkbox"
            // Use defaultChecked for checkboxes based on boolean value
            defaultChecked={currentValues.isPublic === true}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600 dark:ring-offset-gray-800"
            aria-describedby="isPublic-error"
          />
          <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
            Make event publicly discoverable?
          </label>
          {actionData?.errors?.isPublic && (
            // Note: Checkbox errors might need specific handling/placement
            <p className="ml-4 mt-1 text-sm text-red-600" id="isPublic-error">
              {actionData.errors.isPublic}
            </p>
          )}
        </div>


        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 border-t border-gray-200 pt-4 dark:border-gray-700">
           <button
             type="button"
             onClick={() => window.history.back()} // Simple back navigation
             className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
           >
             Cancel
           </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Form>
    </div>
  );
}
