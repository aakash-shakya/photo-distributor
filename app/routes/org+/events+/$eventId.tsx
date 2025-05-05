import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useFetcher, useParams } from "@remix-run/react";
import { prisma } from "~/db.server";
import { requireUser } from "~/utils/auth.server";
import invariant from "tiny-invariant";
import type { Event, EventPhoto, Participant } from "@prisma/client"; // Add Participant type
import { format } from 'date-fns';
import { uploadFileToStorage, deleteFileFromStorage, triggerFaceMatchingLambda } from "~/utils/storage.server"; // Import storage helpers

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const eventName = data?.event?.name ?? "Event Details";
  return [{ title: eventName }];
};

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
      orgId: orgUser.orgId,
    },
    include: {
      photos: {
        orderBy: { uploadTime: 'desc' },
        select: { id: true, imageUrl: true, uploadTime: true, uploaderUserId: true }
      },
      // Fetch actual participants now
      participants: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, registrationStatus: true }
      }
    }
  });

  if (!event) {
    throw new Response("Event not found or access denied", { status: 404 });
  }

  // No longer need simulated participants

  const formattedEvent = {
      ...event,
      dateStartFormatted: format(new Date(event.dateStart), 'PPP p'),
      dateEndFormatted: event.dateEnd ? format(new Date(event.dateEnd), 'PPP p') : null,
      photos: event.photos.map(photo => ({
          ...photo,
          uploadTimeFormatted: format(new Date(photo.uploadTime), 'Pp')
      })),
      // Participants are now included directly from the loader
  };

  return json({ event: formattedEvent });
}

// Action function to handle various intents on the event page
export async function action({ request, params }: ActionFunctionArgs) {
    const user = await requireUser(request);
    invariant(params.eventId, "Missing eventId param");

    const orgUser = await prisma.organizationUser.findFirst({
        where: { userId: user.id },
        select: { orgId: true },
    });

    if (!orgUser) {
        return json({ error: "User not associated with an organization" }, { status: 403 });
    }

     // Verify event ownership/existence before proceeding
     const event = await prisma.event.findFirst({
      where: { id: params.eventId, orgId: orgUser.orgId },
      select: { id: true },
    });

    if (!event) {
      return json({ error: "Event not found or access denied" }, { status: 404 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    console.log("Action Intent:", intent);

    // --- Photo Upload Intent ---
    if (intent === "uploadPhoto") {
        const photoFile = formData.get("photoFile");

        if (!photoFile || typeof photoFile !== 'object' || photoFile.size === 0) {
            return json({ intent, error: "No file selected or file is empty.", photoUploadSuccess: false }, { status: 400 });
        }

        try {
            // 1. Upload file to storage (replace stub with real implementation)
            const imageUrl = await uploadFileToStorage(photoFile, `events/${params.eventId}/photos`);

            // 2. Create EventPhoto record in database
            await prisma.eventPhoto.create({
                data: {
                    eventId: params.eventId,
                    uploaderUserId: user.id,
                    imageUrl: imageUrl,
                    // thumbnailUrl: await generateThumbnail(imageUrl), // Optional: Generate thumbnail
                    uploadTime: new Date(),
                    reviewStatus: 'PENDING', // Or 'APPROVED' depending on workflow
                    isPublic: false, // Default to private
                    // metadata: await extractExifData(photoFile), // Optional: Extract metadata
                }
            });

            return json({ intent, photoUploadSuccess: true, message: `${photoFile.name} uploaded successfully.` });

        } catch (error) {
            console.error("Photo upload failed:", error);
            // TODO: Add cleanup logic (e.g., delete uploaded file if DB insert fails)
            return json({ intent, error: "Failed to upload photo. Please try again.", photoUploadSuccess: false }, { status: 500 });
        }
    }

    // --- Delete Photo Intent ---
    if (intent === "deletePhoto") {
        const photoId = formData.get("photoId") as string;
        if (!photoId) {
            return json({ intent, error: "Missing photo ID.", photoDeleteSuccess: false }, { status: 400 });
        }
        console.log("Attempting to delete photo:", photoId);

        try {
            // 1. Find the photo to verify ownership and get URL
            const photo = await prisma.eventPhoto.findFirst({
                where: {
                    id: photoId,
                    eventId: params.eventId,
                    // Optional: Add check for uploaderUserId or org admin role if needed
                },
                select: { id: true, imageUrl: true }
            });

            if (!photo) {
                 return json({ intent, error: "Photo not found or access denied.", photoDeleteSuccess: false }, { status: 404 });
            }

            // 2. Delete photo record from database
            await prisma.eventPhoto.delete({
                where: { id: photoId }
            });

            // 3. Delete file from storage (replace stub with real implementation)
            await deleteFileFromStorage(photo.imageUrl);

            return json({ intent, photoDeleteSuccess: true, deletedPhotoId: photoId, message: `Photo deleted successfully.` });

        } catch (error) {
             console.error("Photo deletion failed:", error);
             return json({ intent, error: "Failed to delete photo. Please try again.", photoDeleteSuccess: false }, { status: 500 });
        }
    }

    // --- Initiate Face Matching Intent ---
     if (intent === "initiateFaceMatching") {
        console.log("Attempting to initiate face matching for event:", params.eventId);

        try {
            // 1. Check if there are photos and participants
            const photoCount = await prisma.eventPhoto.count({ where: { eventId: params.eventId } });
            const participantCount = await prisma.participant.count({ where: { eventId: params.eventId } });

            if (photoCount === 0) {
                return json({ intent, error: "Cannot initiate matching without uploaded photos.", faceMatchingInitiated: false }, { status: 400 });
            }
            if (participantCount === 0) {
                 return json({ intent, error: "Cannot initiate matching without added participants.", faceMatchingInitiated: false }, { status: 400 });
            }

            // 2. Create FaceMatchingTask record
            const task = await prisma.faceMatchingTask.create({
                data: {
                    eventId: params.eventId,
                    status: 'PENDING',
                    // Optionally add requestedByUserId: user.id
                }
            });

            // 3. Trigger external process (replace stub with real implementation)
            await triggerFaceMatchingLambda(params.eventId, task.id);

            return json({ intent, faceMatchingInitiated: true, taskId: task.id, message: "Face matching process initiated successfully." });

        } catch (error) {
            console.error("Face matching initiation failed:", error);
            return json({ intent, error: "Failed to initiate face matching. Please try again.", faceMatchingInitiated: false }, { status: 500 });
        }
    }


    // --- Fallback for unknown intents ---
    return json({ intent, error: "Invalid intent", success: false }, { status: 400 });
}


// Component for individual photo item with delete button
function PhotoItem({ photo }: { photo: Pick<EventPhoto, 'id' | 'imageUrl'> & { uploadTimeFormatted: string } }) {
  const fetcher = useFetcher();
  const params = useParams();
  const isDeleting = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'deletePhoto' && fetcher.formData?.get('photoId') === photo.id;

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    const confirmation = window.confirm(
      "Are you sure you want to delete this photo? This cannot be undone."
    );
    if (!confirmation) {
      e.preventDefault();
    } else {
        // Submit deletion request using fetcher
        fetcher.submit(
            { intent: 'deletePhoto', photoId: photo.id },
            { method: 'post', action: `/org/events/${params.eventId}` } // Submit to the current event page's action
        );
    }
  };

  return (
    <div key={photo.id} className={`group relative transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
      <img
        src={photo.imageUrl || `https://via.placeholder.com/150/cccccc/888888?text=Error`} // Use actual URL, fallback if missing
        alt={`Event photo uploaded at ${photo.uploadTimeFormatted}`}
        className="aspect-square w-full rounded object-cover bg-gray-200 dark:bg-gray-700" // Add bg color for loading/error state
        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150/cccccc/888888?text=Invalid+URL'; }} // Handle broken image links
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity group-hover:opacity-100">
         <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-75"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        <p>ID: ...{photo.id.slice(-4)}</p>
        <p>Uploaded: {photo.uploadTimeFormatted}</p>
      </div>
    </div>
  );
}


export default function EventDetailsPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const params = useParams();

  // Handle event delete confirmation
  const handleEventDelete = (e: React.FormEvent<HTMLFormElement>) => {
    const confirmation = window.confirm(
      "Are you sure you want to delete this event? This action cannot be undone."
    );
    if (!confirmation) {
      e.preventDefault();
    }
  };

  // Filter out deleted photos based on actionData (client-side removal after successful delete)
   const photos = event.photos.filter(
        (photo) => !(actionData?.intent === 'deletePhoto' && actionData?.photoDeleteSuccess && actionData?.deletedPhotoId === photo.id)
    );


  return (
    <div>
      {/* --- Breadcrumbs and Event Info --- */}
      <nav className="mb-4 text-sm" aria-label="Breadcrumb">
         <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/org/events" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
              Events
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg className="mx-1 h-3 w-3 text-gray-400 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <span className="ms-1 text-sm font-medium text-gray-500 dark:text-gray-400 md:ms-2">{event.name}</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="mb-6 rounded bg-white p-6 shadow dark:bg-gray-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.name}</h1>
           <div className="flex flex-shrink-0 space-x-2">
             <Link
               to="edit"
               className="rounded bg-yellow-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-400"
             >
               Edit Event
             </Link>
             <Form method="post" action={`/org/events/${event.id}/delete`} onSubmit={handleEventDelete} className="inline-block">
                <button
                  type="submit"
                  className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                >
                  Delete Event
                </button>
              </Form>
           </div>
        </div>
         <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{event.status}</dd>
            </div>
            <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Publicly Visible</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{event.isPublic ? 'Yes' : 'No'}</dd>
            </div>
            <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Starts</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{event.dateStartFormatted}</dd>
            </div>
            {event.dateEndFormatted && (
                 <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Ends</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{event.dateEndFormatted}</dd>
                </div>
            )}
             {event.locationName && (
                 <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{event.locationName}</dd>
                    {event.locationAddress && <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">{event.locationAddress}</dd>}
                </div>
            )}
        </div>
        {event.description && (
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Description</h2>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
            </div>
        )}
      </div>


      {/* --- Photo Management Section --- */}
      <div className="mt-8 rounded bg-white p-6 shadow dark:bg-gray-800">
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Photos ({photos.length})</h2>

        {/* Photo Upload Form */}
        <Form method="post" encType="multipart/form-data" className="mb-6 rounded border border-gray-200 p-4 dark:border-gray-700">
           <input type="hidden" name="intent" value="uploadPhoto" />
           <label htmlFor="photoFile" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Upload New Photo</label>
           <div className="flex items-center space-x-4">
                <input
                    type="file"
                    id="photoFile"
                    name="photoFile"
                    accept="image/jpeg, image/png, image/webp, image/gif"
                    required // Make file input required
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                />
                <button
                    type="submit"
                    className="flex-shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                    Upload
                </button>
           </div>
           {/* Feedback Messages */}
           {actionData?.intent === 'uploadPhoto' && actionData.error && (
                 <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
             )}
            {actionData?.intent === 'uploadPhoto' && actionData.photoUploadSuccess && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">{actionData.message}</p>
            )}
             {actionData?.intent === 'deletePhoto' && actionData.error && (
                 <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
             )}
            {actionData?.intent === 'deletePhoto' && actionData.photoDeleteSuccess && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">{actionData.message}</p>
            )}
        </Form>

        {/* Photo Gallery */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.length > 0 ? (
                photos.map((photo) => ( // Use correct type now
                    <PhotoItem key={photo.id} photo={photo} />
                ))
            ) : (
                <p className="col-span-full text-gray-500 dark:text-gray-400">No photos uploaded for this event yet.</p>
            )}
        </div>

        {/* Face Matching Trigger */}
        <Form method="post" className="mt-6 text-right">
            <input type="hidden" name="intent" value="initiateFaceMatching" />
            <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                disabled={photos.length === 0 || event.participants.length === 0} // Disable if no photos or participants
            >
                Initiate Face Matching
            </button>
             {actionData?.intent === 'initiateFaceMatching' && actionData.error && (
                 <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
             )}
            {actionData?.intent === 'initiateFaceMatching' && actionData.faceMatchingInitiated && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">{actionData.message}</p>
            )}
            {(photos.length === 0 || event.participants.length === 0) && (
                 <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Requires uploaded photos and added participants.</p>
            )}
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Note: Face matching is an asynchronous process. Status updates TBD.
             </p>
        </Form>
      </div>


       {/* --- Participant Management Section --- */}
       <div className="mt-8 rounded bg-white p-6 shadow dark:bg-gray-800">
         <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Participants ({event.participants.length})</h2>
            <Link
                to={`/org/events/${params.eventId}/participants/new`}
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
                Add Participant
            </Link>
         </div>

         {/* Participant List (using data from loader) */}
         {event.participants.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {event.participants.map((participant) => (
                    <li key={participant.id} className="py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{participant.name || 'N/A'}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{participant.email || 'No email'}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Status: {participant.registrationStatus || 'Unknown'}</p>
                        {/* Add actions (view details, remove - stubbed) later */}
                    </li>
                ))}
            </ul>
         ) : (
            <p className="text-gray-500 dark:text-gray-400">No participants added yet.</p>
         )}
          <div className="mt-4 text-right">
             <Link
                to={`/org/events/${params.eventId}/participants`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
                Manage All Participants &rarr;
            </Link>
         </div>
         {/* Removed placeholder note about DB functionality */}
      </div>

      {/* Placeholder for other features like Settings, Billing etc. */}
       <div className="mt-8 rounded border border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400">
                Other features (Individual User View, Subscription Management, Advanced Settings) are pending implementation and external service integration.
            </p>
       </div>

    </div>
  );
}
