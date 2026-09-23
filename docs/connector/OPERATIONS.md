# The connector: operator note

For whoever looks after the connector. No code needed. Everything below is something you ask
Lovable in its chat, because there is no dashboard.

## Seeing the logs

Every call to `finish_import` (the step that turns an upload into a waiting import) writes one
line to the log. Paste into Lovable:

```
Answer only, change nothing. Show me the last 20 log lines from the edge function mcp that contain "finish_import".
```

For problems only, ask for lines containing `"outcome":"failed"`, `"outcome":"stuck"`,
`"outcome":"refused"` (the AI did not send every piece) or `"unhandled"`. These also go to
**Sentry** once the secret `SENTRY_DSN` is set. Until then they are in the log only. Neither the
log nor Sentry ever holds a creator's conversation, only ids, counts and times.

## What a healthy finish_import looks like

```
{"mcp":"finish_import","outcome":"parsed","reason":null,"failed_at":null,"status":"parsed", …
 "reader_id":"transcript","chunk_count":9,"total_chars":212000, … "duration_ms":850,"compute_ms":410, …}
```

- `outcome` is `parsed`. (`duplicate` and `replayed` are healthy too: the same conversation was
  sent twice, and nothing new was made.)
- `failed_at` is `null`. When something goes wrong it names the step that failed, such as `routing`.
- `duration_ms` is the whole call, usually under a few seconds.
- `compute_ms` is the time spent removing keys and reading the conversation, which is where the
  platform's 2-second CPU allowance goes. Build manual Part 9, item 4 uses it: under 700 on a
  400,000-character import means the ceiling could be raised; over 1,000 means it stays. The
  platform's own CPU figure is `cpu_time_used`, on the function's "shutdown" log lines. Ask Lovable
  for those if you need it.

## The four states a stuck import can be in

| State | What it means | What to do |
|---|---|---|
| `open` | The AI started sending and never finished, or a piece went missing and it was asked to resend. | Nothing on our side. The creator asks their AI to send it again. |
| `assembling` | `finish_import` started and never finished. Still like this after a few minutes means it crashed part-way. | The one to look at. Its "stuck" report names the step; with no report, the platform stopped the function (ask Lovable for its shutdown lines). The creator sends it again. |
| `parsed` | Not a fault. It arrived and is waiting on https://agent-share-hub.lovable.app/compose/new. | Nothing. The creator reviews it there. |
| `failed` | `finish_import` gave up. The `error` column says why, in plain words. | The creator sends it again as a new import. |

All but `failed` clear themselves after 7 days: the nightly job marks them `expired`.

## Imports that failed in the last day

Paste into Lovable:

```
Answer only, change nothing. Run this query on the database and paste the result:
select id, user_id, reader_id, chunk_count, total_chars, error, updated_at
from public.import_sessions
where status = 'failed' and updated_at > now() - interval '1 day'
order by updated_at desc
limit 50;
```

It never selects the conversation (the `proposal` column), so the answer is safe to share.
