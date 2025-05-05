import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Create New Event" }];
};

// Schema for validation
const EventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  dateStart: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date",
  }),
  // Add other fields as needed: description, location, etc.
});

export async function loader({ request }: LoaderFunctionArgs) {
  // Ensure user is logged in and associated with an org
  await requireUser(request);
  return json({}); // No specific data needed for the form initially
}


export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const formPayload = Object.fromEntries(formData);

   // Find the organization the user belongs to
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
    return json({ errors }, { status: 400 });
  }

  try {
    const newEvent = await prisma.event.create({
      data: {
        name: result.data.name,
        dateStart: new Date(result.data.dateStart),
        status: "DRAFT", // Default status
        orgId: orgUser.orgId,
        // Add other fields here
      },
    });
    // Redirect to the new event's page or the events list
    return redirect(`/org/events/${newEvent.id}`);
  } catch (error) {
    console.error("Failed to create event:", error);
    return json({ errors: { form: "Failed to create event. Please try again." } }, { status: 500 });
  }
}


export default function NewEventPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Create New Event</h1>
      <Form method="post" className="space-y-6 rounded bg-white p-6 shadow dark:bg-gray-800">
        {actionData?.errors?.form && (
          <p className="text-sm text-red-600">{actionData.errors.form}</p>
        )}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Event Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
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

        <div>
          <label htmlFor="dateStart" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Start Date
          </label>
          <input
            id="dateStart"
            name="dateStart"
            type="date" // Use datetime-local for time as well if needed
            required
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

        {/* Add fields for description, location, etc. here */}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Event"}
          </button>
        </div>
      </Form>
    </div>
  );
}
