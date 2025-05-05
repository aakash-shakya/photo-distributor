import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/utils/auth.server";
import type { User } from "@prisma/client";

export const meta: MetaFunction = () => {
  return [{ title: "Organization Dashboard" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  // Fetch organization details associated with the user if needed
  // const org = await prisma.organization.findFirst({...});
  return { user };
}

export default function OrgDashboard() {
   const { user } = useLoaderData<{ user: User }>();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
        Welcome, {user.name || user.email}!
      </h1>
      <p className="text-gray-600 dark:text-gray-300">
        This is your organization dashboard. Manage your events and photos here.
      </p>
      {/* Add dashboard widgets or summaries here */}
    </div>
  );
}
