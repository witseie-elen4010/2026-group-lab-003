# ADR 002: Database Selection

## Status
Accepted

## Context
The application requires a storage solution to manage:
1. User accounts of the Students and Lecturers.
2. Consultation sessions which includes capacity and scheduling.
3. A system-wide Activity Log.
4. Relational integrity to prevent overlapping bookings.

## Decision
We have decided to use **MongoDB** as our primary database.

## Justification
* **MongoDB:** MongoDB's flexible schema is ideal for the Activity Log, allowing us to store diverse action types without complex migrations. Its JSON-like structure aligns perfectly with our Node.js/Express stack, speeding up development in our 1-week sprint cycles.
  
* **Hosting:** Render offers a streamlined, developer-friendly CI/CD pipeline that integrates directly with our GitHub repository. This allows us to satisfy the Sprint 1 deployment requirement with lower configuration overhead compared to Azure.

## Positives
* High structural flexibility allowing rapid iteration on user profiles, consultation objects, and log structures throughout our short sprints.
* Eliminated object-relational mapping friction by aligning the database format directly with JavaScript objects.
* Out-of-the-box support for application-layer schema validation rules through Mongoose, ensuring data correctness before storage operations execute.
* Scalable architecture that seamlessly hooks into cloud cluster infrastructures through environment-secured connection strings (`MONGO_URI`).
* Frictionless integration with our Render deployment pipelines, isolating production configurations cleanly from local development files.

## Negatives
* Lacks native declarative relational constraints (foreign keys), requiring the development team to handle data consistency and referencing logic manually within our backend Express controllers to prevent overlapping bookings.
* Demands disciplined schema design principles within application code to prevent document nesting bloat over long operational cycles.
* Relying on a third-party managed database cluster introduces network latency into our request-response loop compared to an in-memory or localized data store.