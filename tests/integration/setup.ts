import { afterAll } from "vitest";
import { resetDatabase } from "./helpers";

// La base de test est partagée avec les E2E en CI : on ne laisse jamais de données derrière soi.
afterAll(async () => {
  await resetDatabase();
});
