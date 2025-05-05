import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";

import { themeSessionResolver } from "~/services/theme.server"; // We will create this file
import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// Return the theme from the session storage using the loader
export async function loader({ request }: LoaderFunctionArgs) {
	const { getTheme } = await themeSessionResolver(request);
	return json({
		theme: getTheme(),
	});
}

// Wrap the entire app in ThemeProvider
export default function AppWithProviders() {
	const data = useLoaderData<typeof loader>();
	return (
		<ThemeProvider specifiedTheme={data.theme} themeAction="/action/set-theme">
			<App />
		</ThemeProvider>
	);
}


export function App() {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme(); // Use the theme hook

  return (
    <html lang="en" className={theme ?? ""}> {/* Apply theme class */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} /> {/* Prevent theme flash */}
        <Links />
      </head>
      <body className="bg-white dark:bg-gray-950"> {/* Apply base body styles */}
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Remove the default export App function as AppWithProviders is the new default
// export default App;

// Remove the Layout component as it's integrated into App
// export function Layout({ children }: { children: React.ReactNode }) { ... }
