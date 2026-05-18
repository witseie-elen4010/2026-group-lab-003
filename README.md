# Synchro 

Final Product: https://synchro-yb1b.onrender.com

### Group Project - Software Development 3 (ELEN4010)

[![Project Status: Complete](https://img.shields.io/badge/Project%20Status-Complete-brightgreen)](https://github.com/witseie-elen4010/2026-group-lab-003)
[![Coverage Status](https://coveralls.io/repos/github/witseie-elen4010/2026-group-lab-003/badge.svg)](https://coveralls.io/github/witseie-elen4010/2026-group-lab-003)
[![Build Status](https://img.shields.io/badge/CI%2FCD-Passing-blue)](https://github.com/witseie-elen4010/2026-group-lab-003/actions)

## Group Members
* Ngcweti Mjiyako
* Ofentse Tembe 
* Nhlakanipho Mngomezulu 
* Tokelo Mphahlele

---

Synchro is an agile, web-based academic scheduling and consultation platform tailored to bridge the gap between students and lecturers. Built to streamline the process of organizing, booking, and auditing 1-on-1 and group support sessions, the system offers robust role-isolated workflows, live tracking, and resilient transaction handling.

---

## Features

### Lecturer Workflows
* **Dynamic Slot Configuration:** Define precise availability structures by selecting custom dates, start times, session durations, and student seat caps.
* **Global Capacity Management:** Set specific consultation thresholds. Sessions can dynamically scale from private 1-on-1 deep dives to mass group workshops.
* **Unified Consultation Feed:** Track all upcoming, ongoing, active, or canceled sessions directly from an adaptive data dashboard.

### Student Workflows
* **Instant Availability Booking:** Browse open academic windows in real-time. Booking a slot automatically claims the resource and updates global indices to prevent scheduling collisions.
* **Join Open Consultations:** Seamlessly hop into existing group sessions created by peers, provided the lecturer's student threshold has not been reached.
* **Live Status Monitoring:** View clear markers categorizing sessions into Upcoming, Ongoing, Completed, or Canceled states.

### Core Architecture & Security
* **Bcrypt Password Hashing:** User passwords are encrypted using a secure salting mechanism (10 rounds) before hitting long-term storage layer arrays.
* **Environment-Balanced Notification Router:** System uses an automated email handler that pipes transaction routing through the native filesystem locally and securely swaps to the Brevo RESTful HTTP API over Port 443 in production to bypass hosting firewalls.
* **Interactive Profile Customization:** Fully structured forms allowing users to modify personal directory mappings like standard names, surnames, and account configurations cleanly.

---

## Tech Stack

* **Runtime & Backend Framework:** Node.js, Express.js
* **Frontend Architecture:** HTML5, CSS3 (Custom Modules), JavaScript (ES6+), Bootstrap 5
* **Security & Crypto:** Bcrypt (Cryptographic password protection)
* **API Delivery Matrix:** Brevo RESTful HTTP API Engine
* **Testing Infrastructure:** Jest & Supertest Integration Frame

---

## Repository Architecture

```text
├── .github/workflows/      # Automated GitHub Actions CI/CD workflows
├── documentation/          # Agile Sprint logs, Retrospectives, and Architecture Decision Records (ADRs)
├── public/                 # Client assets (HTML wireframes, interface styles, frontend scripts)
├── scripts/                # Database configuration wrappers and pipeline seeding utilities
├── src/                    # Backend architecture engine (Express routing, core logic, controllers)
├── tests/                  # Robust regression testing suite (Unit and Integration)
├── package.json            # Core project dependency definitions and launch configurations
└── package-lock.json       # Strict dependency tree locks
```

---

## Getting Started

### Prerequisites
Ensure you have the latest stable version of Node.js (v18+ recommended) and npm installed on your operating system.

### Local Installation & Run Loop

**1. Clone the repository**
```bash
git clone [https://github.com/witseie-elen4010/2026-group-lab-003.git](https://github.com/witseie-elen4010/2026-group-lab-003.git)
cd 2026-group-lab-003
```

**2. Provision the local environment file**
Create a .env file in the root directory of the project and supply the following variables:
```env
PORT=3000
MONGO_URI=ymongodb+srv://mjiyakongcweti_db_user:ProjectPass2026@cluster0.rr6mogr.mongodb.net/?appName=Cluster0
```

**3. Install dependencies**
```bash
npm install
```

**4. Fire up the development engine**
```bash
npm start
```
The server will bind locally. Access the application interface by navigating to http://localhost:3000 inside your preferred web browser.

---

## Verification & Testing

To execute the test matrix and assert backend controllers, runtime boundaries, and validation routers:
```bash
npm test
```

To run checks with an output mapping codebase test density coverage:
```bash
npm run test:coverage
```

---

## Dynamic Lifecycle Walkthrough

```text
[ Lecturer Dashboard ] ──> Sets open slots (Time, Date, Limit) ──> Published to Global Pool
                                                                             │
[ Student Dashboard  ] ──> Views Pool ──> [ Creates Booking ] ───────────────┤
                                                  │                          ▼
                                                  └──> Slot drops out of open search
                                                       (Other students can join via "Existing"
                                                       if capacity limit is > 1)
```

1. **Scheduling Provision:** A Lecturer authenticates, configures a support window specifying an exact student limit, and commits it.
2. **Registry Mapping:** The server creates the asset and broadcasts it to the shared consultation index pools.
3. **Consumption Phase:** A Student registers a booking reservation. The slot drops from the absolute open availability grid to prevent race conditions.
4. **Shared Access Branching:** If the max student configuration for that slot is greater than 1, other peers can discover and latch onto the existing slot until the collection cap is satisfied.

---

*Developed for Wits University — Software Development 3 (ELEN4010).*