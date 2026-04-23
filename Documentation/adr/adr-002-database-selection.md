# ADR 002: Database Selection

## Status
[![Project Status: Proposed](https://img.shields.io/badge/Database%20Selection%20Status-Proposed-yellow)](https://github.com/)

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
  
* **Hosting** Render offers a streamlined, developer-friendly CI/CD pipeline that integrates directly with our GitHub repository. This allows us to satisfy the Sprint 1 deployment requirement with lower configuration overhead compared to Azure.

## Consequences
* **Development:** The team will implement a centralized db-connection.js utility using the Mongoose ODM to manage connections and enforce schema validation.
* **Security:** Database connection strings will be stored as Environment Variables within the Render dashboard to prevent credential leaks.
* **CI/CD:** Every push to the main branch will trigger an automated build and deploy on Render, ensuring a continuous delivery workflow.
