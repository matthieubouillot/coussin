import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-url";

export default function setup() {
  const url = testDatabaseUrl();
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url },
  });
}
