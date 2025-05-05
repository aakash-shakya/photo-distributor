import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { sessionStorage } from "~/services/session.server.ts";
import { prisma } from "~/db.server";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
export const authenticator = new Authenticator<User>(sessionStorage);

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    // Basic validation
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Use a generic message to prevent email enumeration
      throw new Error("Invalid login credentials.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Invalid login credentials.");
    }

    // The user object will be stored in the session.
    // Don't store sensitive data like the password hash!
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }),
  // each strategy has a name and can be changed to use another one
  // same strategy multiple times, the name is the key to use to
  // authenticate with the specified strategy.
  "user-pass"
);
