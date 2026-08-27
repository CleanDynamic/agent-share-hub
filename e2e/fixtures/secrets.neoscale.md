Build File for the inbox summariser. I pasted my config in verbatim so you can
see exactly what I ran.

```json
{
  "neoscale_build": 1,
  "exported_at": "2026-08-21T09:15:00.000Z",
  "source_url": "https://neoscaleai.com/b2/inbox-summariser",
  "build": {
    "title": "Inbox summariser",
    "outcome": "Summarises the morning inbox into five bullets.",
    "shape": "script",
    "made_for": ["myself"],
    "made_with": ["Claude"],
    "live_url": null,
    "repo_url": null,
    "cost": null,
    "time_to_first_result": 20
  },
  "nodes": [
    {
      "path": "1",
      "type": "prompt",
      "title": "Summarise the inbox",
      "note": null,
      "payload": {
        "text": "Summarise these emails into five bullets, most urgent first."
      },
      "children": []
    },
    {
      "path": "2",
      "type": "note",
      "title": "My .env, for reference",
      "note": null,
      "payload": {
        "body": "OPENAI_API_KEY=sk-EXAMPLENOTAREALKEY000000000000\nMODEL=claude-opus-4"
      },
      "children": []
    }
  ],
  "events": []
}
```
