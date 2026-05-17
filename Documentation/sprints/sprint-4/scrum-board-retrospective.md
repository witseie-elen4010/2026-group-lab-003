# 📌 Sprint 4 Report (Final Sprint)

**📅 Date of Meeting:** 2026-05-17  
**👥 Team:** Group-003  

---

### 📊 Sprint Summary
* **Number of user stories planned:** 8
* **Number of user stories completed/delivered:** 9 (1 ad-hoc story added mid-sprint)
* **Sprint Outcome:** **100% Completion Rate.** We successfully completed our entire planned backlog, closed the gap on previous legacy debt, and dynamically absorbed a critical feature enhancement mid-sprint to deliver a fully functional, finalized system.

---

### ✅ What Went Well
* **Full-System Integration:** We successfully finalized the core "wiring" of the system, fully connecting the backend architecture to both the Lecturer and Activity Log modules.
* **UI Polish & Quality of Life:** Dashboards received targeted frontend improvements, including smarter dynamic scheduling components (such as intuitive "Today/Tomorrow" date transformations) to elevate the user experience.
* **Testing & CI/CD Excellence:** We integrated Coveralls into our workflow to track code health and achieved a highly resilient **79% test coverage rate**, ensuring long-term system stability.
* **Scope Agility:** When an unexpected requirement emerged mid-sprint, the team effectively refactored workloads to plan, build, and deliver an extra 9th user story with zero delays.

---

### ⚠️ What Went Wrong (Technical Debt & Process Friction)
* **The Render SMTP Firewall Trap:** While implementing critical password resets and OTP verification, we hit a major environmental roadblock. Everything passed perfectly on local machines, but silently failed and timed out once deployed to production.
* **Debugging Time Sink:** The team lost valuable hours troubleshooting Nodemailer transport sockets before uncovering that Render's Free Tier strictly firewalls standard outbound mail ports (25, 465, 587).
* **Emergency Pivot Pressure:** Navigating this hosting constraint created localized panic, forcing us to abandon standard SMTP architecture entirely late in the cycle and race to implement a workaround via Brevo's HTTP API.

---

### 🚀 Key Takeaways & Long-Term Lessons
* **Fail-Fast Production Smoke Testing:** We have learned to abandon the assumption that "working locally means working in production." For future engineering projects, any user story relying on third-party integrations or external network protocols must be smoke-tested in the live production environment immediately rather than waiting for local validation.
* **Cloud Infrastructure Research:** Before writing code for external services, future development should dedicate time to thoroughly review cloud provider-specific network restrictions to prevent architectural mismatches.
* **Proactive SPIKE Allocations:** As a definitive project takeaway, complex backend mechanisms (like mass notifications, authentication systems, or external APIs) should always be explicitly designated as technical "Spikes" at the very beginning of a project lifecycle to uncover potential runtime barriers ahead of time.

---

### 🏁 Conclusion
**Sprint 4 Status: COMPLETED (9/9 Stories).** This final week marked a monumental achievement for Group-003. Despite fighting an unforgiving infrastructure blocker with Render’s network security layers, the team demonstrated excellent engineering resourcefulness by pivoting to an API-driven delivery model with Brevo. With all legacy modules active, our UI polished, and automated test coverage sitting firmly at 79%, the ecosystem is fully delivered and in its strongest possible state.