Here is the Build File for the invoice chaser we worked on. I have followed the
Extractor and kept every prompt exactly as you sent it.

```json
{
  "neoscale_build": 1,
  "exported_at": "2026-08-20T11:30:00.000Z",
  "source_url": "https://neoscaleai.com/b2/invoice-chaser",
  "build": {
    "title": "Invoice chaser that reads the inbox",
    "outcome": "Chases unpaid invoices from a Gmail label and logs every reply to a sheet.",
    "shape": "agent",
    "made_for": ["freelancers"],
    "made_with": ["Claude", "Zapier"],
    "live_url": null,
    "repo_url": null,
    "cost": { "setup": 0, "monthly": 12, "currency": "GBP" },
    "time_to_first_result": 45
  },
  "nodes": [
    {
      "path": "1",
      "type": "system_prompt",
      "title": "Chaser persona",
      "note": "Kept short on purpose — a longer persona made it apologise.",
      "payload": {
        "text": "You chase unpaid invoices. Be brief, polite and specific about the amount and the due date."
      },
      "children": []
    },
    {
      "path": "2",
      "type": "prompt",
      "title": "Draft the first chase",
      "note": null,
      "payload": {
        "text": "Here is an overdue invoice: {{invoice}}. Draft a first chase email of at most four sentences.",
        "model": "claude-opus-4",
        "variables": [
          { "name": "invoice", "description": "The overdue invoice record", "example": "INV-1042, GBP 480, due 12 Aug" }
        ]
      },
      "children": [
        {
          "path": "2.1",
          "type": "note",
          "title": "Why four sentences",
          "note": null,
          "payload": {
            "body": "Anything longer read as a legal letter and two clients replied asking if they were in trouble."
          },
          "children": []
        }
      ]
    },
    {
      "path": "3",
      "type": "tool_definition",
      "title": "append_reply_to_sheet",
      "note": null,
      "payload": {
        "name": "append_reply_to_sheet",
        "description": "Appends one reply row to the tracking sheet."
      },
      "children": []
    }
  ],
  "events": [
    {
      "ordinal": 1,
      "kind": "milestone",
      "payload": { "text": "First chase sent to a real client and answered within a day." },
      "phase_title": "Getting it sending"
    },
    {
      "ordinal": 2,
      "kind": "breakage",
      "payload": { "symptom": "Threading broke when a client replied from a different address." },
      "phase_title": "Getting it sending"
    }
  ]
}
```

That is everything. Drop this straight into /import.
