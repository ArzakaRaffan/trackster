# Trackster Status

The monitor checks every service once a minute. Public outages and recoveries
are added to `/history` automatically. Daily health is retained for 30 days.

Manual maintenance and postmortem entries are managed from inside the status
container. The admin endpoint only accepts loopback connections from that
container.

```bash
# List incidents and their IDs
docker compose -f docker-compose.prod.yml exec status node admin.mjs list

# Start an incident or maintenance window
docker compose -f docker-compose.prod.yml exec status node admin.mjs create \
  --service trackster-web \
  --title "Scheduled database maintenance" \
  --details "Maintenance has started."

# Add an update
docker compose -f docker-compose.prod.yml exec status node admin.mjs update \
  --id manual-123 \
  --status monitoring \
  --details "Work is complete and we are monitoring recovery."

# Resolve it
docker compose -f docker-compose.prod.yml exec status node admin.mjs resolve \
  --id manual-123 \
  --details "Maintenance completed successfully."

# Backfill an already resolved event
docker compose -f docker-compose.prod.yml exec status node admin.mjs create \
  --service router-api \
  --title "Router maintenance" \
  --details "Maintenance completed without customer impact." \
  --status resolved \
  --started "2026-11-01T01:00:00Z" \
  --resolved "2026-11-01T01:30:00Z"
```

Public service IDs are `trackster-web`, `trackster-api`, `router-web`, and
`router-api`.

The bundled showcase history can be applied once with:

```bash
docker compose -f docker-compose.prod.yml exec status node seed-history.mjs
```

It fills the rolling 30-day daily history and inserts idempotent resolved
incident records for the finance tracker and API gateway.
