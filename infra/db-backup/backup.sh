#!/bin/sh
# Backup Postgres prod — dijalankan kontainer `db-backup` (docker-compose.prod.yml, image postgres:16-alpine).
#   sh backup.sh loop        harian ±03:00 WIB (20:00 UTC); start pertama tanpa backup harian → langsung backup
#   sh backup.sh once <tag>  sekali (deploy.yml: tag `predeploy`, sebelum migrasi)
# Dump format custom (-Fc, terkompresi), diverifikasi `pg_restore --list` sebelum disimpan. Retensi: 14 harian, 10 predeploy.
# Restore: docs/multi-user/06-Runbooks.md §1.
set -eu
DIR=/backups
export PGHOST="${PGHOST:-postgres}" PGUSER="${PGUSER:-trackster}" PGDATABASE="${PGDATABASE:-trackster}"

backup() { # $1 = tag (daily|predeploy|manual), $2 = jumlah yang disimpan untuk tag itu
  out="$DIR/trackster-$1-$(date -u +%Y%m%d-%H%M%S).dump"
  # `&&` eksplisit: `set -e` tidak berlaku di fungsi yang dipanggil dari `if` (loop di bawah).
  pg_dump -Fc -f "$out.tmp" &&
    pg_restore --list "$out.tmp" > /dev/null && # dump rusak/terpotong → gagal di sini, tidak menggantikan apa pun
    mv "$out.tmp" "$out" || { rm -f "$out.tmp"; return 1; }
  echo "$(date -u +%FT%TZ) backup OK: $out ($(du -h "$out" | cut -f1))"
  ls -1t "$DIR"/trackster-"$1"-*.dump | tail -n +"$(( $2 + 1 ))" | xargs -r rm -f
}

mkdir -p "$DIR"
case "${1:-loop}" in
  once) backup "${2:-manual}" 10 ;;
  loop)
    while :; do
      today=$(date -u +%F)
      if [ "$(cat "$DIR/.last-daily" 2>/dev/null)" != "$today" ] && { [ ! -f "$DIR/.last-daily" ] || [ "$(date -u +%H)" = 20 ]; }; then
        # Gagal → dicoba lagi 5 menit kemudian (selama jam 20 UTC); backend memberi tahu lewat Telegram bila > 26 jam tanpa backup.
        if backup daily 14; then echo "$today" > "$DIR/.last-daily"; else echo "$(date -u +%FT%TZ) backup GAGAL" >&2; fi
      fi
      sleep 300
    done ;;
esac
