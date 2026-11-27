openbuilds_map: 1
build: support-inbox-triage
width: standard
background: grey
numbers: build

## Row
- Text · cols 12
  How the support inbox triage is built. 9 tiles in 3 sessions. Classify and Refund rules run side by side, then Draft and send uses both.

## Row
Frame: Part A
- Box S1 · cols 6 · tiles 1 2 3 · Stack · notes left
  Title: Classify
  Explanation: Every email gets one label before anything else.
  Note 1: Starts the build. Runs at the same time as Prompt 4.
  Note 3: Waits for the rules.
- Box S2 · cols 6 · tiles 4 5 6 · Stack · notes right · indent 6 · fill green
  Title: Refund rules
  Explanation: Runs alongside Classify. Its rules feed Prompt 3.
  Note 6: Indented one level: it tests Code 5.

## Row
Frame: Part B
- Column · cols 12
  - Box S3 · cols 12 · tiles 7 8 · Across
    Title: Draft and send
    Explanation: Starts once the labels and rules are merged.
  - Box S3 · cols 12 · tiles 9
    Title: Result

## Two-way
- 1 <-> 4
