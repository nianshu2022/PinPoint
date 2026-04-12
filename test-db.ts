import Database from 'better-sqlite3';
const db = new Database('.data/hub/d1/app.sqlite3');
const rows = db.prepare("SELECT title, storage_key, exif, is_live_photo FROM photos ORDER BY date_taken DESC LIMIT 2").all();
console.log(JSON.stringify(rows, null, 2));
