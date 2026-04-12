import sqlite3
import json

def export_db(db_file, out_file):
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all tables except sensitive ones
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_migrations'")
    tables = [row['name'] for row in cursor.fetchall()]
    
    # Exclude tables storing secret keys to pass GitHub Push Protection
    sensitive_tables = ['settings', 'settings_storage_providers']
    tables = [t for t in tables if t not in sensitive_tables]
    
    with open(out_file, 'w', encoding='utf-8') as f:
        # Avoid foreign key constraint issues during import
        f.write("PRAGMA defer_foreign_keys=TRUE;\n")
        
        for table in tables:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            
            if not rows:
                continue
            
            # Write a comment for readability
            f.write(f"\n-- Data for {table} --\n")
            
            for row in rows:
                keys = list(row.keys())
                values = []
                for key in keys:
                    val = row[key]
                    if val is None:
                        values.append('NULL')
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    else:
                        # Escape single quotes and treat everything else as string/text
                        val_str = str(val).replace("'", "''")
                        values.append(f"'{val_str}'")
                
                keys_str = ", ".join([f'"{k}"' for k in keys])
                values_str = ", ".join(values)
                f.write(f"INSERT OR IGNORE INTO \"{table}\" ({keys_str}) VALUES ({values_str});\n")
                
    conn.close()

export_db('app.sqlite3', 'data_dump.sql')
print("Successfully generated data_dump.sql")
