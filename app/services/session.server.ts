// app/services/session.server.ts
import { createCookieSessionStorage } from "@remix-run/node";
import invariant from "tiny-invariant";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

// export the whole sessionStorage object
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie applies to all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: [process.env.SESSION_SECRET], // replace this with an actual secret
    secure: process.env.NODE_ENV === "production", // enable this in prod only
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

// you can also export the methods individually for convenience
export const { getSession, commitSession, destroySession } = sessionStorage;
