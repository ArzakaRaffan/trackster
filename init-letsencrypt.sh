#!/bin/bash
# Jalankan sekali aja di VPS, sebelum pertama kali `docker compose -f docker-compose.prod.yml up -d`.
# Script ini bikin dummy certificate dulu biar nginx bisa start, lalu tukar ke certificate asli dari Let's Encrypt.

set -e

EMAIL="isi-email-kamu@gmail.com"   # <-- GANTI dengan email asli, buat notifikasi expiry dari Let's Encrypt
RSA_KEY_SIZE=4096
DATA_PATH="./nginx/certbot"

# Dua grup domain: masing-masing grup akan punya 1 certificate sendiri (sesuai nginx config kita)
declare -A CERT_GROUPS
CERT_GROUPS["track.trackster.my.id"]="track.trackster.my.id"
CERT_GROUPS["api.track.trackster.my.id"]="api.track.trackster.my.id"

echo "### Download recommended TLS params ..."
mkdir -p "$DATA_PATH/conf"
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

for primary_domain in "${!CERT_GROUPS[@]}"; do
  domains=${CERT_GROUPS[$primary_domain]}
  path="/etc/letsencrypt/live/$primary_domain"

  echo "### [$primary_domain] Membuat dummy certificate ..."
  mkdir -p "$DATA_PATH/conf/live/$primary_domain"
  docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
      -keyout '$path/privkey.pem' \
      -out '$path/fullchain.pem' \
      -subj '/CN=localhost'" certbot
done

echo "### Menyalakan nginx (pakai dummy cert dulu) ..."
docker compose -f docker-compose.prod.yml up -d nginx

for primary_domain in "${!CERT_GROUPS[@]}"; do
  domains=${CERT_GROUPS[$primary_domain]}

  echo "### [$primary_domain] Hapus dummy certificate ..."
  docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
    rm -Rf /etc/letsencrypt/live/$primary_domain && \
    rm -Rf /etc/letsencrypt/archive/$primary_domain && \
    rm -Rf /etc/letsencrypt/renewal/$primary_domain.conf" certbot

  echo "### [$primary_domain] Minta certificate asli dari Let's Encrypt ..."
  domain_args=""
  for domain in $domains; do
    domain_args="$domain_args -d $domain"
  done

  docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      --email $EMAIL \
      $domain_args \
      --rsa-key-size $RSA_KEY_SIZE \
      --agree-tos \
      --no-eff-email \
      --force-renewal" certbot
done

echo "### Reload nginx dengan certificate asli ..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "### Selesai! Cek https://trackster.my.id dan https://api.trackster.my.id"
