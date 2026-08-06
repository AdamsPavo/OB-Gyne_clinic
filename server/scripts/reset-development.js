const bcrypt = require("bcrypt");
const db = require("../database/database");

async function reset() {
  if (process.env.NODE_ENV === "production") throw new Error("Database reset is disabled in production.");
  const hash = await bcrypt.hash("admin123", 12);
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all().map((row) => row.name);
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    for (const table of tables) db.prepare(`DELETE FROM "${table.replaceAll('"', '""')}"`).run();
    db.prepare("DELETE FROM sqlite_sequence").run();
    db.prepare(`INSERT INTO users (fullname,full_name,username,password,password_hash,role,is_active)
      VALUES (?,?,?,?,?,'admin',1)`).run("System Administrator", "System Administrator", "admin", hash, hash);
  })();
  db.pragma("foreign_keys = ON");
  console.log("Development database reset. Login: admin / admin123");
}

reset().catch((error) => { console.error(error); process.exitCode = 1; });
