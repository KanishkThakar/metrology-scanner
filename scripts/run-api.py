"""Start the API without moving an existing SQLite database or scan files."""
import os
import sys
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

root = Path(__file__).resolve().parents[1]
load_dotenv(root / '.env')
os.chdir(root / 'backend')
sys.path.insert(0, str(root / 'backend'))
uvicorn.run('main:app', host=os.getenv('API_HOST', '0.0.0.0'), port=int(os.getenv('PORT', '8000')))
