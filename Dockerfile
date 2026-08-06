FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_STOCK_ROOT=/app \
    AI_STOCK_BETA_REQUIRE_INVITE=1 \
    AI_STOCK_WEB_SECURE_COOKIE=1 \
    AI_STOCK_BETA_DB_PATH=/data/beta-access.sqlite3

WORKDIR /app

COPY requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements-web.txt

COPY . .
RUN mkdir -p /data

EXPOSE 8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
