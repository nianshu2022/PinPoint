const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('app.sqlite3');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_migrations'").all();

let sqlContent = '';

for (const { name } of tables) {
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  if (rows.length === 0) continue;
  
  // Format the INSERT statements
  for (const row of rows) {
    const keys = Object.keys(row);
    const values = Object.values(row).map(val => {
      if (val === null) return 'NULL';
      if (typeof val === 'string') {
        return `'${val.replace(/'/g, "''")}'`;
      }
      return val;
    });
    
    sqlContent += `INSERT INTO ${name} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
  }
}

fs.writeFileSync('migration_dump.sql', sqlContent);
console.log('Successfully generated migration_dump.sql containing ' + sqlContent.split('\n').length + ' lines.');
db.close();
