# ── Stage 1: Build React Frontend ─────────────────────────
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Sadece package.json dosyasını kopyalıyoruz
COPY frontend/package.json ./

# --no-package-lock ekleyerek zehirli kilit dosyasını devre dışı bırakıyoruz
RUN npm install --legacy-peer-deps --no-package-lock

COPY frontend/ ./
ENV NODE_OPTIONS=--openssl-legacy-provider
RUN npm run build

# ── Stage 2: Python Backend + Static Files ────────────────
FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./static

# Create data directory
RUN mkdir -p /data

# Serve static files from FastAPI
RUN echo '\n\
from fastapi.staticfiles import StaticFiles\n\
from fastapi.responses import FileResponse\n\
import os\n\
\n\
# Mount static files\n\
app.mount("/static", StaticFiles(directory="static/static"), name="static")\n\
\n\
@app.get("/{full_path:path}")\n\
async def serve_spa(full_path: str):\n\
    file_path = os.path.join("static", full_path)\n\
    if os.path.isfile(file_path):\n\
        return FileResponse(file_path)\n\
    return FileResponse("static/index.html")\n\
' >> main.py

EXPOSE 8000

ENV DB_PATH=/data/rezervasyon.db

VOLUME ["/data"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
