/**
 * Création d'un compte administrateur (il n'existe aucune inscription publique).
 *   pnpm admin:create <email> "<Nom affiché>"
 * Le mot de passe est demandé de façon masquée ; la 2FA sera imposée à la première connexion.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";

// Saisie non interactive (tests, CI) : les lignes de l'entrée standard sont lues dans l'ordre.
let pipedLines: string[] | null = null;

async function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    if (!pipedLines) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
      pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    }
    return pipedLines.shift() ?? "";
  }
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const [emailArg, nameArg] = process.argv.slice(2);
  const email = z.email().toLowerCase().parse(emailArg);
  const name = z
    .string()
    .min(1)
    .parse(nameArg ?? "Administrateur");

  if (await db.user.findUnique({ where: { email } })) throw new Error(`Un compte existe déjà pour ${email}`);

  const password = await askHidden("Mot de passe (12 caractères minimum) : ");
  if ((await askHidden("Confirmation : ")) !== password)
    throw new Error("Les mots de passe ne correspondent pas");
  z.string().min(12).max(128).parse(password);

  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });
  await db.auditLog.create({
    data: { action: "admin.account.created", targetType: "user", targetId: user.id },
  });
  console.warn(`Compte admin créé pour ${email}. La 2FA sera demandée à la première connexion.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
