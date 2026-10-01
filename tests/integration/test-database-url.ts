import "dotenv/config";

/** Base de test : TEST_DATABASE_URL, sinon DATABASE_URL avec le nom de base remplacé par coussin_test. */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL ou TEST_DATABASE_URL requis pour les tests d'intégration");
  const url = new URL(base);
  url.pathname = "/coussin_test";
  return url.toString();
}
