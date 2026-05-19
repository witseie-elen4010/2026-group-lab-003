# ADR 003: Express.js Backend Web Framework

## Status
Accepted

## Context
The Synchro consultation scheduler requires a robust, asynchronous backend to handle multiple simultaneous student bookings, lecturer availability scheduling, and user authentication. The ELEN4010 project brief explicitly mandates the use of Node.js in conjunction with the Express framework for the server-side architecture. We needed to ensure that this mandated framework could efficiently handle middleware for our Bcrypt security, serve our Bootstrap-based frontend, and support automated end-to-end testing.

## Decision
We will use Express.js as our primary backend web application framework on top of the Node.js runtime environment.

## Justification
While Express.js is a mandatory constraints-driven requirement of the curriculum, its selection is structurally justified by the rapid, iterative lifecycle of our four consecutive one-week sprints. Given the tight submission timeline, using a heavier or more rigidly opinionated framework would introduce unnecessary setup friction and a steep learning curve for the team. 

Express allows us to map our granular business validation criteria (such as enforcing non-overlapping consultations and keeping counts under the daily capacity cap) directly into lightweight, explicit route handlers. Its native, asynchronous non-blocking I/O model ensures that multiple incoming student scheduling requests can be completed concurrently without stalling the server thread. Additionally, because the platform relies heavily on custom action logs, Express's sequential middleware execution chain allows us to intercept every incoming payload effortlessly to create an immutable system audit trail before saving records to the persistent database.

## Consequences

**Positive:**
* Absolute compliance with the strict technical requirements of the group laboratory brief.
* Express is highly unopinionated and lightweight, allowing the team to flexibly structure routes and controllers to isolate the student and lecturer workflows.
* It provides an extensive middleware ecosystem, making it trivial to integrate secure session management, body parsing, and our database connections.
* It integrates seamlessly with Supertest and Jest, allowing us to hit our required automated test coverage metrics easily.

**Negative:**
* Because Express does not force a specific architecture, the team had to invest sprint planning time upfront to agree on a standardized folder repository structure (`/src/routes`, `/src/controllers`) to prevent disorganized code.
* It requires manual configuration for global error handling and request validation compared to heavier, fully integrated frameworks.