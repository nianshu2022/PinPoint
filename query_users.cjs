const db = require('better-sqlite3')('app.sqlite3');
const rows = db.prepare('SELECT email, username FROM users').all();
console.log('USERS:');
console.log(rows);
