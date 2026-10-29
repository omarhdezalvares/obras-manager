import "dotenv/config";

// Cada archivo de test usa su propio schema de Postgres (corren en paralelo) y lo recrea con db push --force-reset.
export function usarSchemaDeTest(schema: string): void {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("Falta TEST_DATABASE_URL (Postgres sin pooler de transacciones) para los tests con base de datos");
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = process.env.DIRECT_URL = url.toString();
}
