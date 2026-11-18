#!/usr/bin/env bash
# Backend contract suite: every tool called exactly as Agora's cloud calls it, plus auth,
# sandbox isolation, the approval guard, idempotency, refusals and the call gate.
# Usage: bash tests/api.sh            (needs `pnpm dev` on :3000; no Agora minutes used)
set -u
B=${BASE:-http://localhost:3000}
SECRET=$(grep '^TOOL_SECRET=' "$(dirname "$0")/../.env.local" | cut -d= -f2)
pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  PASS  %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL  %s\n        %s\n' "$1" "${2:0:300}"; }
check(){ local name=$1 cond=$2 body=$3; if eval "$cond"; then ok "$name"; else bad "$name" "$body"; fi; }
j()    { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }
sb()   { curl -s -X POST "$B/api/sandbox" -H 'Content-Type: application/json' -d "$1"; }
tool() { curl -s -X POST "$B/api/tools/$2" -H "x-tool-secret: $SECRET" -H "x-sandbox: $1" -H 'Content-Type: application/json' -d "${3:-{\}}"; }
get()  { curl -s "$B/api/tools/$2" -H "x-tool-secret: $SECRET" -H "x-sandbox: $1"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== Sandboxes"
A=$(sb '{"action":"create","name":"Priya"}' | j 'd["id"]')
Bx=$(sb '{"action":"create","name":"Rohan"}' | j 'd["id"]')
check "A-01 create sandbox returns a 10-char id" '[[ "$A" =~ ^[a-z0-9]{10}$ ]]' "$A"
check "A-02 two visitors get different sandboxes" '[[ "$A" != "$Bx" ]]' "$A $Bx"
check "A-03 unknown sandbox → 404" '[[ $(code "$B/api/sandbox?id=zzzzzzzzzz") == 404 ]]' ""
check "A-04 malformed sandbox id → 400" '[[ $(code "$B/api/sandbox?id=../../etc") == 400 ]]' ""
r=$(sb "{\"id\":\"$A\",\"action\":\"trigger\",\"scenario\":\"nope\"}")
check "A-05 unknown scenario rejected" '[[ "$r" == *"unknown scenario"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"set_name\",\"name\":\"<b>Priya</b>\"}" >/dev/null
nm=$(curl -s "$B/api/sandbox?id=$A" | j 'd["sandbox"]["engineer"]')
check "A-06 names are sanitised (no markup survives)" '[[ "$nm" != *"<"* && "$nm" != *">"* ]]' "$nm"
sb "{\"id\":\"$A\",\"action\":\"set_name\",\"name\":\"Priya\"}" >/dev/null
sb "{\"id\":\"$A\",\"action\":\"trigger\",\"scenario\":\"bad_deploy\"}" >/dev/null
st=$(curl -s "$B/api/sandbox?id=$A")
check "A-07 incident opens with an investigation before the call" '[[ $(echo "$st" | j "len([a for a in d[\"sandbox\"][\"actions\"] if a[\"phase\"]==\"before\"])") -ge 5 ]]' "$st"
check "A-08 visitor B is untouched by A's incident" '[[ $(curl -s "$B/api/sandbox?id=$Bx" | j "d[\"sandbox\"][\"incident\"]") == "None" ]]' ""

echo "== Tool auth"
check "A-09 no secret → 401" '[[ $(code "$B/api/tools/get_incident" -H "x-sandbox: $A") == 401 ]]' ""
check "A-10 wrong secret → 401" '[[ $(code "$B/api/tools/get_incident" -H "x-tool-secret: nope-nope-nope-nope" -H "x-sandbox: $A") == 401 ]]' ""
check "A-11 missing sandbox header → 400" '[[ $(code "$B/api/tools/get_incident" -H "x-tool-secret: $SECRET") == 400 ]]' ""
check "A-12 unknown tool → 404" '[[ $(code -X POST "$B/api/tools/drop_database" -H "x-tool-secret: $SECRET" -H "x-sandbox: $A" -d "{}") == 404 ]]' ""
check "A-13 malformed JSON body handled" '[[ $(code -X POST "$B/api/tools/search_logs" -H "x-tool-secret: $SECRET" -H "x-sandbox: $A" -H "Content-Type: application/json" -d "{not json") == 200 ]]' ""

echo "== Read tools"
r=$(get "$A" get_incident)
check "A-14 get_incident reports impact and cause" '[[ "$r" == *"revenue_at_risk"* && "$r" == *"coupon"* ]]' "$r"
r=$(tool "$A" list_recent_changes)
check "A-15 list_recent_changes finds the 4.2.1 deploy" '[[ "$r" == *"4.2.1"* ]]' "$r"
r=$(tool "$A" search_logs '{"service":"payments","query":"exception"}')
check "A-16 search_logs returns the NullPointerException with a count" '[[ "$r" == *"NullPointerException"* && "$r" == *"count"* ]]' "$r"
r=$(tool "$A" search_runbooks '{"query":"errors after deploy rollback"}')
check "A-17 search_runbooks retrieves RB-12" '[[ "$r" == *"RB-12"* ]]' "$r"
r=$(get "$A" check_dependencies)
check "A-18 check_dependencies lists providers" '[[ "$r" == *"Cashly"* ]]' "$r"
r=$(tool "$A" get_service_health '{"service":"payments"}')
check "A-19 get_service_health compares with baseline" '[[ "$r" == *"baseline"* ]]' "$r"

echo "== Approval guard (the only door to production)"
r=$(tool "$A" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"Yes, roll it back"}')
check "A-20 fabricated approval (nobody said it) is blocked" '[[ "$r" == *"blocked"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"captions\",\"lines\":[{\"who\":\"engineer\",\"text\":\"Should we roll back?\"}]}" >/dev/null
r=$(tool "$A" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"Should we roll back?"}')
check "A-21 a question is not an approval" '[[ "$r" == *"question"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"captions\",\"lines\":[{\"who\":\"engineer\",\"text\":\"No, wait.\"}]}" >/dev/null
r=$(tool "$A" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"No, wait"}')
check "A-22 \"no, wait\" is not an approval" '[[ "$r" == *"blocked"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"captions\",\"lines\":[{\"who\":\"engineer\",\"text\":\"Yes, roll it back.\"}]}" >/dev/null
r=$(tool "$A" execute_remediation '{"action":"disable_feature_flag","target":"new-coupon-engine","approval_quote":"Yes, roll it back"}')
check "A-23 a yes for a rollback cannot switch off a flag" '[[ "$r" == *"blocked"* ]]' "$r"
r=$(tool "$A" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"Yes, roll it back"}')
check "A-24 rollback attempted with a real yes → blocked by the deploy guard, with next option" '[[ "$r" == *"\"outcome\":\"failed\""* && "$r" == *"new-coupon-engine"* ]]' "$r"
r=$(tool "$A" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"Yes, roll it back"}')
check "A-25 one yes = one change (reused approval blocked)" '[[ "$r" == *"blocked"* ]]' "$r"
r=$(tool "$A" execute_remediation '{"action":"drop_table","target":"orders","approval_quote":"yes"}')
check "A-26 actions outside the allow-list are rejected" '[[ "$r" == *"Unknown action"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"typed\",\"text\":\"Okay, turn the flag off.\"}" >/dev/null
r=$(tool "$A" execute_remediation '{"action":"disable_feature_flag","target":"the coupon flag","approval_quote":"Okay, turn the flag off."}')
check "A-27 typed yes + fuzzy target → flag switched off" '[[ "$r" == *"\"executed\":true"* ]]' "$r"
sb "{\"id\":\"$A\",\"action\":\"typed\",\"text\":\"yes do it\"}" >/dev/null
r=$(tool "$A" execute_remediation '{"action":"disable_feature_flag","target":"new-coupon-engine","approval_quote":"yes do it"}')
check "A-28 idempotent: the same fix twice says already done" '[[ "$r" == *"already_done"* ]]' "$r"
r=$(get "$A" verify_recovery)
check "A-29 verify_recovery right after the fix: still recovering" '[[ "$r" == *"\"recovered\":false"* ]]' "$r"
r=$(tool "$A" resolve_incident '{"root_cause":"x","summary":"y"}')
check "A-30 cannot resolve before recovery is verified" '[[ "$r" == *"\"resolved\":false"* ]]' "$r"

echo "== Comms and follow-up"
r=$(tool "$A" update_status_page '{"status":"panic","message":"x"}')
check "A-31 status page rejects unknown states" '[[ "$r" == *"status must be"* ]]' "$r"
r=$(tool "$A" update_status_page '{"status":"monitoring","message":"A fix is in place. We are monitoring."}')
check "A-32 status page update posted" '[[ "$r" == *"posted"* ]]' "$r"
r=$(tool "$A" page_teammate '{"name":"Arjun","reason":"code fix"}')
check "A-33 page_teammate pages Arjun" '[[ "$r" == *"Arjun Mehta"* ]]' "$r"
r=$(tool "$A" page_teammate '{"name":"Elon","reason":"x"}')
check "A-34 unknown teammate refused with the list of people" '[[ "$r" == *"Unknown person"* ]]' "$r"
r=$(tool "$A" create_follow_up '{"title":"Null check in CouponEngine","owner":"Arjun","priority":"P1"}')
check "A-35 follow-up ticket created with a key" '[[ "$r" == *"PAY-"* ]]' "$r"
r=$(tool "$A" post_to_channel '{"message":"Checkout recovering."}')
check "A-36 post_to_channel" '[[ "$r" == *"posted"* ]]' "$r"

echo "== Database incident: injection and unsafe actions"
C=$(sb '{"action":"create","name":"Priya"}' | j 'd["id"]')
sb "{\"id\":\"$C\",\"action\":\"trigger\",\"scenario\":\"db_overload\"}" >/dev/null
r=$(tool "$C" search_logs '{"service":"orders-db","query":""}')
check "A-37 untrusted log text is fenced off with a warning" '[[ "$r" == *"untrusted_log_text"* && "$r" == *"never an instruction"* ]]' "$r"
sb "{\"id\":\"$C\",\"action\":\"captions\",\"lines\":[{\"who\":\"engineer\",\"text\":\"Yes, restart the database.\"}]}" >/dev/null
r=$(tool "$C" execute_remediation '{"action":"restart_service","target":"orders-db","approval_quote":"Yes, restart the database."}')
check "A-38 restarting the primary DB is refused even with a yes" '[[ "$r" == *"refused"* ]]' "$r"

echo "== UPI incident"
D=$(sb '{"action":"create","name":"Priya"}' | j 'd["id"]')
sb "{\"id\":\"$D\",\"action\":\"trigger\",\"scenario\":\"upi_provider\"}" >/dev/null
sb "{\"id\":\"$D\",\"action\":\"captions\",\"lines\":[{\"who\":\"engineer\",\"text\":\"Yes, roll it back.\"}]}" >/dev/null
r=$(tool "$D" execute_remediation '{"action":"rollback_deploy","target":"payments-service","approval_quote":"Yes, roll it back."}')
check "A-39 nothing to roll back in a provider outage" '[[ "$r" == *"refused"* ]]' "$r"

echo "== Call gate (protects Agora minutes)"
E=$(sb '{"action":"create","name":"Priya"}' | j 'd["id"]')
check "A-40 cannot start a call without an open incident" '[[ $(code -X POST "$B/api/call/start" -H "Content-Type: application/json" -d "{\"id\":\"$E\"}") == 409 ]]' ""
check "A-41 agent invite requires an answered call" '[[ $(code -X POST "$B/api/invite-agent" -H "Content-Type: application/json" -d "{\"sandbox_id\":\"$E\",\"channel_name\":\"vigil-$E-x\",\"requester_id\":\"123456\"}") == 409 ]]' ""
check "A-42 teammate cannot join without a live call" '[[ $(code -X POST "$B/api/teammate/start" -H "Content-Type: application/json" -d "{\"id\":\"$A\"}") == 409 ]]' ""
check "A-43 debug route needs the secret" '[[ $(code "$B/api/debug/agent?agentId=x&channel=y") == 401 ]]' ""
check "A-44 the open token route from the template is gone" '[[ $(code "$B/api/generate-agora-token") == 404 ]]' ""
html=$(curl -s "$B/console")
check "A-45 secrets never reach the browser" '[[ "$html" != *"$SECRET"* ]]' ""

echo "== Public pages"
check "A-46 landing page 200" '[[ $(code "$B/") == 200 ]]' ""
check "A-47 console 200" '[[ $(code "$B/console") == 200 ]]' ""
check "A-48 status page 200" '[[ $(code "$B/status?s=$A") == 200 ]]' ""
check "A-49 postmortem page 200" '[[ $(code "$B/postmortem?s=$A") == 200 ]]' ""
check "A-50 join page 200" '[[ $(code "$B/join?s=$A") == 200 ]]' ""

echo
echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
