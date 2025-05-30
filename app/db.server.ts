import { PrismaClient } from "@prisma/client";
import invariant from "tiny-invariant";

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// In production, we'll have a single connection to the DB.
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      // Log Prisma queries in development
      // log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.__prisma;
  prisma.$connect();
}

export { prisma };
