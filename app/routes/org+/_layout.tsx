import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, Link, useLoaderData, Form } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import type { User } from "@prisma/client";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authentication for all routes under /org
  // Later, add role checks if needed (e.g., require ORG roles)
  const user = await requireUser(request);
  return { user };
}

export default function OrgLayout() {
  const { user } = useLoaderData<{ user: User }>();

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-gray-800 text-white shadow-md">
        <nav className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/org" className="text-xl font-bold">
            Event Platform Org
          </Link>
          <div className="flex items-center space-x-4">
             <Link to="/org/events" className="hover:text-gray-300">Events</Link>
             {/* Add other org navigation links here */}
             <span className="text-sm text-gray-400">({user.email})</span>
             <Form action="/logout" method="post">
               <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500">
                 Logout
               </button>
             </Form>
          </div>
        </nav>
      </header>
      <main className="flex-grow overflow-y-auto bg-gray-100 p-6 dark:bg-gray-900">
        <div className="container mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
