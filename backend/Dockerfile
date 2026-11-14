# Build from the repo root, so the demo leases in data/ are in the build context:
#   docker build -f backend/Dockerfile -t newcomer-hub-api .
# The image keeps the repo layout (/app/backend next to /app/data/sample_leases), which is
# where services/gemini.py looks for the DEMO_CACHE files. Config comes from env vars only;
# .dockerignore keeps .env files out of the image.
# Same Python as the laptops the tests run on (requirements.txt is pinned against it).
FROM python:3.14-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY data/sample_leases/ /app/data/sample_leases/
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
