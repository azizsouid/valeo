# backend/run.py
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path='.flaskenv')
load_dotenv()

# Make sure this import is correct:
from app import create_app

# This 'app' variable is what Flask looks for by default
app = create_app()

if __name__ == '__main__':
    app.run(debug=True)