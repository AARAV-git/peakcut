# Inference image: API + database only (no training dependencies, no uploads scoring unless
# you add the 'features' extra, which pulls in torch and is much larger).
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
COPY sql ./sql
COPY configs ./configs
RUN pip install --no-cache-dir ".[api]"
ENV PEAKCUT_SQL_DIR=/app/sql PEAKCUT_DB=/app/data/db/peakcut.duckdb PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "peakcut.api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
