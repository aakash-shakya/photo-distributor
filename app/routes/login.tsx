import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getSession, commitSession } from "~/services/session.server"; // Assuming you have this

export const meta: MetaFunction = () => {
  return [{ title: "Login" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // If the user is already authenticated redirect to their dashboard
  // Check user role to redirect appropriately if needed later
  return await authenticator.isAuthenticated(request, {
    successRedirect: "/org", // Default redirect, adjust based on role later
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // we call the method with the name of the strategy we want to use and the
    // request object, optionally we pass an object with the URLs we want the user
    // to be redirected to after a success or a failure
    return await authenticator.authenticate("user-pass", request, {
      successRedirect: "/org", // Redirect to org dashboard for now
      // The `throwOnError` option will tell the authenticator to throw the error instead of returning it.
      // This is useful for returning responses on errors.
      throwOnError: true,
    });
  } catch (error) {
     // Because redirects work by throwing a Response, you need to check if the error
    // is a Response and return it or throw it again
    if (error instanceof Response) return error;

    // If it's not a Response, return the error message to display to the user
    // Ensure error has a 'message' property or handle appropriately
    const message = error instanceof Error ? error.message : "An unknown error occurred.";

    // Get the session to add the error message
    const session = await getSession(request.headers.get("Cookie"));
    session.flash("error", message); // Use flash message for errors

    // Commit the session along with the response
    return new Response(null, {
      status: 401, // Unauthorized
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}


export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>(); // Use if returning data directly, not needed with flash

  // TODO: Read flash message from loader if implemented

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-gray-100">
          Login
        </h1>
        <Form method="post" className="space-y-6">
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? undefined}
          />
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email address
            </label>
            <input
              id="email"
              required
              autoFocus={true}
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              aria-invalid={actionData?.error ? true : undefined} // Adjust if using actionData for errors
              aria-describedby="email-error"
            />
            {/* Display error message here if using actionData */}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
              aria-invalid={actionData?.error ? true : undefined} // Adjust if using actionData for errors
              aria-describedby="password-error"
            />
             {/* Display error message here if using actionData */}
          </div>

           {/* Display general form error from flash message here */}
           {/* Example: const { error } = useLoaderData<typeof loader>(); */}
           {/* {error && <div className="text-sm text-red-600">{error}</div>} */}


          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Log in
          </button>
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            {/* Link to signup page if/when created */}
            <Link
              to="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Sign up
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
