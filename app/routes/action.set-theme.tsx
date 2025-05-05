// app/routes/action.set-theme.tsx
import { createThemeAction } from "remix-themes";

import { themeSessionResolver } from "~/services/theme.server";

export const action = createThemeAction(themeSessionResolver);
