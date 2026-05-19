# ADR 001: Render Deployment Platform Selection

## Status
Accepted

## Context
Section 3.3 of the technical requirements specifies that the application must be hosted on a cloud platform (suggesting Microsoft Azure as a standard baseline) to ensure general availability via a public production URL. The platform must support automated deployment pipelines, securely isolate runtime credentials via environment variables, and manage web traffic over secure HTTPS. During our infrastructure staging phase, the team encountered significant blockers setting up Microsoft Azure due to restricted student subscription privileges, complex identity management (IAM) structures, and heavy configuration friction. We needed to quickly select and agree upon an alternative cloud provider that could host our Node.js runtime without delaying our sprint releases.

## Decision
We will bypass Microsoft Azure and utilize Render as our alternative primary cloud infrastructure provider to host our production web service, linking it directly to our main GitHub branch for continuous delivery.

## Justification
The team explicitly agreed to pivot to Render to overcome the subscription and provisioning bottlenecks encountered on Azure, ensuring we did not miss our production deployment deadlines. Render provides a streamlined Platform-as-a-Service (PaaS) model that natively supports the Node.js runtime without the heavy virtual network configuration or infrastructure-as-code management required by Azure.

Render is architecturally justified for our agile sprint cycle because it mirrors the trunk-based development workflow required by our rubric. By connecting Render to our GitHub repository webhooks, we achieve full automation for our continuous deployment (CD) pipeline. Every time a peer-reviewed pull request is merged into our default branch, Render initiates an automated build runner (`npm install` and `npm start`) and executes a zero-downtime rolling update. It securely maps our critical production secrets (such as `MONGO_URI` and `BREVO_API_KEY`) completely away from the public source code, provisions SSL certificates out-of-the-box, and gives us a reliable production URL to submit to our assessors before tonight's final deadline.

## Consequences

**Positive:**
* Successfully bypassed Azure account access restrictions, allowing the group to meet the public hosting requirement on time.
* Seamless continuous delivery setup that automatically keeps our production deployment synchronized with the stable code trunk.
* Automatic SSL certificate provisioning, ensuring all transactional communication between students and lecturers takes place safely over HTTPS.
* Simplified environment variable management, isolating production configurations cleanly from development files.

**Negative:**
* The platform enforces a restrictive 30-day free trial limitation on certain database and hosting features, meaning the application environment is transient and requires immediate evaluation by the course assessors before the environment expires.
* Offers less granular control over underlying virtual network topologies and operating system kernels compared to a full Azure Virtual Machine or App Service ecosystem.