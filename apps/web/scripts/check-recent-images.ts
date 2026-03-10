import postgres from "postgres";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const rows = await client`
    SELECT id, title, "imageUrl", "createdAt"
    FROM recipes
    ORDER BY "createdAt" DESC
    LIMIT 5
  `;
  console.log(JSON.stringify(rows, null, 2));
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
