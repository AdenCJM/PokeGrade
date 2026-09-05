#!/usr/bin/env bash
# Snapshot the local SQLite ledger into a small JSON file the public site
# renders as the verified log (predictions joined to any recorded PSA outcome).
# Re-run whenever you want the site refreshed, then commit
# src/data/ledger-snapshot.json. Card identities are the engine's own read of
# the card (name / set / number); no user data is involved.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="engine/.data/ledger.db"
OUT="src/data/ledger-snapshot.json"
if [ ! -f "$DB" ]; then
  echo "No ledger at $DB (run the engine at least once)." >&2
  exit 1
fi
rows=$(sqlite3 -json "$DB" "
  select
    substr(p.created_at, 1, 10) as date,
    c.name as name,
    c.set_name as set_name,
    c.number as number,
    p.verdict as verdict,
    p.confidence as confidence,
    p.limiting_pillar as limiting_pillar,
    p.centering_front as centering_front,
    p.centering_back as centering_back,
    p.reason_codes as reason_codes,
    p.ev_estimate as ev_estimate,
    a.psa_grade as psa_grade,
    a.cert as cert
  from predictions p
  left join cards c on c.card_id = p.card_id
  left join actuals a on a.id = (
    select id from actuals where card_id = p.card_id order by id desc limit 1
  )
  order by p.created_at desc;
")
total=$(sqlite3 "$DB" "select count(*) from predictions;")
returns=$(sqlite3 "$DB" "select count(*) from actuals where psa_grade is not null;")
first=$(sqlite3 "$DB" "select substr(min(created_at),1,10) from predictions;")
printf '{\n  "snapshot_date": "%s",\n  "predictions": %s,\n  "psa_returns": %s,\n  "first_prediction": "%s",\n  "rows": %s\n}\n' \
  "$(date -u +%Y-%m-%d)" "$total" "$returns" "$first" "$rows" > "$OUT"
echo "Wrote $OUT ($total predictions, $returns PSA returns)."
