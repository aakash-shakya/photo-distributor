import { Outlet } from "@remix-run/react";

// This layout applies to all routes under /org/events
export default function EventsLayout() {
  return (
    <div>
      {/* You could add common elements for event pages here, like breadcrumbs */}
      <Outlet />
    </div>
  );
}
