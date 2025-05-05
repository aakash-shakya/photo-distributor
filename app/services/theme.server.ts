// app/services/theme.server.ts
import { createThemeSessionResolver } from "remix-themes";
import { sessionStorage } from "~/services/session.server"; // Reuse your existing session storage

export const themeSessionResolver = createThemeSessionResolver(sessionStorage);
