"""Copy an existing SQLite database to an EMPTY PostgreSQL database.

The source is read-only. IDs, timestamps and JSON evidence are preserved. Copy
the uploads/ and reports/ directories separately to METROLOGY_DATA_DIR before
switching the API's DATABASE_URL. Existing target data is never overwritten.
"""
import argparse
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, select, text
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / '.env')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=root / 'backend/inspections.db')
args = parser.parse_args()
target_url = os.getenv('TARGET_DATABASE_URL', '')
if not target_url.startswith(('postgres://','postgresql://','postgresql+psycopg://')):
    sys.exit('Set TARGET_DATABASE_URL to the empty target PostgreSQL database.')
if not args.source.is_file():
    sys.exit('Source SQLite file does not exist.')

# Import only the existing schema against the source, never auto-seed the target.
# SQLAlchemy SQLite URI mode needs the file: prefix.
os.environ['DATABASE_URL'] = 'sqlite:///file:' + str(args.source.resolve()) + '?mode=ro&uri=true'
sys.path.insert(0,str(root / 'backend'))
from database import Base
for prefix in ('postgres://','postgresql://'):
    if target_url.startswith(prefix): target_url='postgresql+psycopg://'+target_url[len(prefix):]
source=create_engine(os.environ['DATABASE_URL'])
target=create_engine(target_url)
Base.metadata.create_all(target)
with source.connect() as reader, target.begin() as writer:
    for table in Base.metadata.sorted_tables:
        if writer.execute(select(table.c.id).limit(1)).first():
            sys.exit('Target has existing data; no records were copied. Use an empty database.')
    counts={}
    for table in Base.metadata.sorted_tables:
        rows=reader.execute(select(table)).mappings().all()
        if rows: writer.execute(table.insert(),[dict(row) for row in rows])
        # Table names are fixed schema metadata, never command-line input.
        writer.execute(text("SELECT setval(pg_get_serial_sequence(:table, 'id'), COALESCE((SELECT MAX(id) FROM " + table.name + "), 1), EXISTS(SELECT 1 FROM " + table.name + "))"),{'table':table.name})
        counts[table.name]=len(rows)
print('Copied rows:',counts)
print('Source SQLite data was left intact. Copy uploads and reports before switching the API.')
