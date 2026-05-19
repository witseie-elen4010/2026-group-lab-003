# ADR 005: Production email delivery

## Status
Accepted

## Context
The Synchro consultation scheduler requires an automated system to notify students and lecturers immediately when consultations are booked or canceled. In production environments (such as Render or Azure), standard SMTP ports (25, 465, or 587) are heavily restricted or entirely firewalled by cloud hosting providers to prevent outbound spam. To ensure reliable notification delivery without dealing with port blocks or complex mail server setups, we required a notification solution that communicates securely over standard HTTPS (Port 443). Additionally, this system must not disrupt automated testing environments or deplete live API quotas during development.

## Decision
We will utilize the Brevo (formerly Sendinblue) RESTful HTTP API to route production email transactions via secure HTTPS requests over Port 443. This service will be wrapped in an environment-balanced notification router that dynamically checks the system configuration (`NODE_ENV`). When running in development or testing modes, the router will intercept the transaction and write the email payload cleanly to the local filesystem instead of hitting the live external API.

## Justification
Deploying the web application to cloud environments like Render introduces severe network-layer restrictions that render traditional SMTP transmission channels completely non-functional. Leveraging the Brevo RESTful HTTP API over Port 443 bypasses these outbound firewall blocks entirely by routing notification traffic as standard encrypted web requests, guaranteeing high-availability message delivery between students and lecturers.

Furthermore, integrating an environment-balanced notification router directly supports the project's strict criteria for automated testing and continuous integration under the Scrum lifecycle. During rapid test executions via Jest and Supertest on GitHub Actions, the system must remain self-contained and network-independent to prevent broken builds caused by rate-limiting or network latency. By dynamically reading the `NODE_ENV` flag, the backend routes transactional updates to the native local file system during local development and testing phases. This pattern preserves our external production API quotas, protects sensitive user credentials in non-production environments, and eliminates external dependencies from our automated test pipelines while maintaining architectural consistency.

## Consequences

**Positive:**
* Complete elimination of network firewall and hosting port conflicts by routing communication over standard web traffic routes (Port 443).
* High delivery reliability and transactional monitoring capabilities provided by an established third-party SaaS engine.
* Isolation of development and automated testing activities, preventing unnecessary API quota exhaustion and protecting the live platform configuration during local executions.
* Clean separation of credentials via environment variables (`BREVO_API_KEY`), satisfying core security principles.

**Negative:**
* Introduces a firm external dependency on the uptime and availability of the third-party Brevo service matrix.
* Requires architectural abstraction to wrap the API calls, creating a minor maintenance overhead should the external API payload schema change in the future.