# ADR 007: Testing Framework and Continuous Integration Automation

## Status
Accepted

## Context
The project brief requires a verifiable strategy for software quality assurance, stating that developers must document and execute acceptance tests for every user story. To achieve an Excellent rating in the Testing rubric, execution must be fully automated using the Jest framework whenever changes are integrated into our primary branch, and test coverage metrics must be systematically generated. We required a testing architecture capable of performing isolated unit tests on our scheduling validation algorithms (e.g., verifying capacity limits and overlapping time boundaries) as well as integration testing on our Express routing endpoints without mutating production data.

## Decision
We will adopt the Jest framework alongside Supertest for our test suite, and automate test executions via GitHub Actions on every pull request and trunk merge.

## Justification
Using Jest combined with Supertest is highly justified because it allows the team to simulate HTTP requests against our Express routers in memory. This means we can rigorously test student booking logic, dashboard views, and role-based access restrictions without spinning up a live HTTP network server, keeping our test execution incredibly fast during local development.

Automating this suite through GitHub Actions ensures strict compliance with our Trunk-Based Development workflow. By configuring a workflow runner that triggers on every pull request, the system automatically checks that new feature commits do not break existing consultation management logic or security layers before code can be merged. This pipeline protects the remote Render deployment instance from executing unstable code, generates automated code coverage reports, and fulfills the strict automation criteria required for the highest mark tier.

## Positives
* Guarantees that code testability is maintained across all 4 sprints, preventing regressions in core scheduling logic.
* Fast, isolated in-memory testing of endpoints via Supertest without relying on live external server dependencies.
* Automated feedback loops in GitHub pull requests give reviewers immediate confidence before merging code into the default branch.
* Simplifies compliance with the rubric's demands for continuous integration and transparent test reporting.

## Negatives
* Creating automated tests for complex, time-dependent validation logic (such as checking matching day and hour constraints for lecturer availability) requires additional development time and meticulous mock setup.
* Running full automated integration pipelines on GitHub Actions introduces minor execution waiting times during the pull request review process.