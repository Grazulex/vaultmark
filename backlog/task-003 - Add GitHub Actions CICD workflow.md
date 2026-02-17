---
id: 3
title: Add GitHub Actions CI/CD workflow
status: In Progress
priority: medium
assignees:
  - '@claude'
labels:
  - ci
  - chore
subtasks: []
dependencies: []
blocked_by: []
created_date: '2026-02-17T21:07:44.841Z'
updated_date: '2026-02-17T21:10:52.876Z'
changelog:
  - timestamp: '2026-02-17T21:07:44.841Z'
    action: created
    details: Task created
    user: system
  - timestamp: '2026-02-17T21:07:51.822Z'
    action: modified
    details: Task updated
    user: AI
  - timestamp: '2026-02-17T21:07:52.539Z'
    action: updated
    details: 'status: To Do → In Progress'
    user: user
  - timestamp: '2026-02-17T21:10:52.876Z'
    action: modified
    details: Task updated
    user: AI
acceptance_criteria: []
ai_plan: |-
  ## Plan
  ### Fichiers
  - .github/workflows/ci.yml (create)

  ### Jobs
  1. lint - biome check
  2. test - vitest run
  3. build - tsc + fix-imports

  ### Triggers
  - push to main
  - pull_request to main

  ### Matrix
  - Node 20, 22
ai_review: |-
  ## Self-Review

  ### Complete
  - [x] GitHub Actions CI: lint, test (Node 20+22), build
  - [x] Claude Code skill: SKILL.md + COMMANDS.md
  - [x] Ecosystem rule updated (7 outils)

  ### Tests
  - CI workflow YAML syntaxiquement correct
  - Skill reconnu par Claude Code (visible dans skills list)
---
Lint (biome), test (vitest), build (tsc) on push/PR to main
