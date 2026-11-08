#!/usr/bin/env bash
# Read-only permission checks against the live API using real demo accounts.
# Usage: AURIC_CLERK_PASSWORD=... AURIC_FINANCE_PASSWORD=... bash tests/api/permissions.sh
# Never writes to the ledger: every write attempted here is expected to be refused.
set -uo pipefail
. ./.env
U=$VITE_SUPABASE_URL; K=$VITE_SUPABASE_PUBLISHABLE_KEY; pass=0; fail=0
tok() { curl -s "$U/auth/v1/token?grant_type=password" -H "apikey: $K" -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))'; }
check() { if [[ "$2" == *"$3"* ]]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 -> ${2:0:160}"; fi; }
C=$(tok clerk@auric.demo "$AURIC_CLERK_PASSWORD"); F=$(tok finance@auric.demo "$AURIC_FINANCE_PASSWORD")
H() { echo -H "apikey: $K" -H "Authorization: Bearer $1" -H 'content-type: application/json'; }
req() { local t=$1; shift; curl -s -o /tmp/auric_body -w '%{http_code}' -H "apikey: $K" -H "Authorization: Bearer $t" -H 'content-type: application/json' "$@"; echo -n " "; cat /tmp/auric_body; }

check "clerk: stock statement refused" "$(req "$C" "$U/rest/v1/rpc/get_stock_statement" -d '{"_from":"2026-11-01","_to":"2026-11-08"}')" "Finance head access required"
check "clerk: balances refused" "$(req "$C" "$U/rest/v1/rpc/get_karigar_balances" -d '{}')" "Finance head access required"
check "clerk: trends refused" "$(req "$C" "$U/rest/v1/rpc/get_wastage_trends" -d '{}')" "Finance head access required"
check "clerk: loss alerts hidden" "$(req "$C" "$U/rest/v1/loss_alerts?select=id")" "200 []"
check "clerk: audit log hidden" "$(req "$C" "$U/rest/v1/audit_logs?select=id")" "200 []"
check "clerk: category edit refused" "$(req "$C" "$U/rest/v1/rpc/save_item_category" -d '{"_id":null,"_category_name":"X","_allowed_wastage_percent":1,"_is_active":true}')" "Only the finance head"
check "clerk: add karigar refused" "$(req "$C" "$U/rest/v1/rpc/save_karigar" -d '{"_id":null,"_karigar_code":"KG-999","_full_name":"X","_phone":"","_preferred_language":""}')" "Only the finance head"
check "clerk: can read karigars" "$(req "$C" "$U/rest/v1/karigars?select=karigar_code&karigar_code=eq.KG-001")" "KG-001"
for T in C F; do tk=${!T}
  check "$T: direct issue edit refused" "$(req "$tk" -X PATCH "$U/rest/v1/gold_issues?transaction_number=eq.TX-30411" -d '{"gross_weight":1}')" "permission denied"
  check "$T: direct receipt delete refused" "$(req "$tk" -X DELETE "$U/rest/v1/gold_receipts?transaction_number=eq.TX-30438")" "permission denied"
  check "$T: direct insert refused" "$(req "$tk" "$U/rest/v1/gold_issues" -d '{"transaction_number":"X"}')" "permission denied"
done
check "finance: stock statement allowed" "$(req "$F" "$U/rest/v1/rpc/get_stock_statement" -d '{"_from":"2026-11-01","_to":"2026-11-08"}')" "200 ["
check "anon: karigars hidden" "$(curl -s -H "apikey: $K" "$U/rest/v1/karigars?select=id")" "permission denied"
check "anon: stock refused" "$(curl -s -H "apikey: $K" -H 'content-type: application/json' "$U/rest/v1/rpc/get_stock_statement" -d '{"_from":"2026-11-01","_to":"2026-11-08"}')" "permission denied"
# Concurrency (no writes): 10 simultaneous over-receipts against the same issue must ALL be refused.
IID=$(curl -s -H "apikey: $K" -H "Authorization: Bearer $C" "$U/rest/v1/gold_issues?select=id&transaction_number=eq.TX-30411" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
for i in $(seq 10); do (curl -s -H "apikey: $K" -H "Authorization: Bearer $C" -H 'content-type: application/json' "$U/rest/v1/rpc/create_gold_receipt" \
  -d "{\"_issue_id\":\"$IID\",\"_receipt_type\":\"scrap\",\"_gross_weight\":5,\"_purity_percent\":91.6,\"_huid\":\"\",\"_receipt_date\":\"2026-11-08\",\"_client_request_id\":\"$(python3 -c 'import uuid;print(uuid.uuid4())')\"}" > /tmp/auric_c$i) & done; wait
ok=$(grep -l "exceeds outstanding" /tmp/auric_c* | wc -l); check "concurrent over-receipts all refused" "$ok" "10"
echo "pass=$pass fail=$fail"; [ "$fail" -eq 0 ]
