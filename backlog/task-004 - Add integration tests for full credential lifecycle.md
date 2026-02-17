---
id: 4
title: Add integration tests for full credential lifecycle
status: In Progress
priority: medium
assignees:
  - '@claude'
labels:
  - test
subtasks: []
dependencies: []
blocked_by: []
created_date: '2026-02-17T21:17:26.496Z'
updated_date: '2026-02-17T21:20:37.561Z'
changelog:
  - timestamp: '2026-02-17T21:17:26.496Z'
    action: created
    details: Task created
    user: system
  - timestamp: '2026-02-17T21:17:27.120Z'
    action: modified
    details: Task updated
    user: AI
  - timestamp: '2026-02-17T21:17:27.737Z'
    action: updated
    details: 'status: To Do → In Progress'
    user: user
  - timestamp: '2026-02-17T21:20:37.561Z'
    action: modified
    details: Task updated
    user: AI
acceptance_criteria: []
ai_plan: |-
  ## Plan

  ### Fichiers
  - tests/integration/lifecycle.test.ts (create)

  ### Scenarios
  1. Full SSH lifecycle: init -> grant -> list -> revoke -> audit
  2. Password lifecycle: password -> list -> cleanup (after expiry)
  3. Multiple credentials: grant x3 -> list -> revoke one -> list -> cleanup
  4. Error cases: grant without init, revoke non-existent, TTL exceeds max

  ### Approche
  - Mock config paths vers tmpDir (comme les unit tests)
  - Pas de mock des core modules - tester le vrai flow
  - Utiliser des TTL courts (1s-2s) pour tester l'expiration
ai_review: >-
  ## Self-Review

  ### Complete

  - [x] 14 integration tests across 5 describe blocks

  - [x] SSH lifecycle: grant -> list -> revoke -> audit

  - [x] Password lifecycle: create -> list -> verify hash

  - [x] Multiple credentials with serial tracking

  - [x] Host filtering, force-command, error cases

  - [x] Cleanup with 1s TTL expiration

  - [x] Credential counts across statuses

  - [x] Full audit trail verification

  ### Bug fixed

  - getExpiredCredentials used SQLite datetime('now') which didn't match ISO
  timestamps -> now uses JS Date
---
End-to-end tests: init CA -> grant SSH cert -> list -> revoke -> cleanup -> audit. Also test password flow.
