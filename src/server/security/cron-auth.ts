import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/** Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». Toute autre requête est refusée. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
