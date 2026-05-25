FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Cloudflare Origin CA — dauerhaft vertrauen
RUN curl -sS https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem \
    -o /usr/local/share/ca-certificates/cloudflare_origin_ca.crt \
    && update-ca-certificates

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
