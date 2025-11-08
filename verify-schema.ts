import "dotenv/config";

const APP_ID = process.env.INSTANTDB_APP_ID;
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

async function verifySchema() {
  const response = await fetch(
    `https://api.instantdb.com/admin/apps/${APP_ID}/schema`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    }
  );
  
  const schema = await response.json();
  console.log("📋 Deployed Schema:");
  console.log("Entities:", Object.keys(schema.entities || {}).join(", "));
  console.log("\nTotal entities:", Object.keys(schema.entities || {}).length);
}

verifySchema();
