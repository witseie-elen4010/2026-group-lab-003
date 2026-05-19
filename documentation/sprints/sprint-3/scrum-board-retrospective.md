# 📌 Sprint 3 Report

**📅 Date of Meeting:** 2026-05-10  
**👥 Team:** Group-003  

---

### 📊 Sprint Summary
* **Number of user stories planned:** 8
* **Number of user stories completed/delivered:** 8
* **Sprint Outcome:** **100% Completion Rate.** We successfully delivered the entire Student-facing ecosystem. All planned features—from booking logic and cancellation to profile management and password recovery—are fully functional and integrated.

---

### ✅ What Went Well
* **Feature Mastery:** We achieved all 8 planned stories, including complex logic like enforcing "Max Consultations per Day" and the "Join Existing Consultation" feature.
* **Student-Side Cohesion:** The Student Dashboard is now a "one-stop-shop" where all student actions are fully connected to the database and live.
* **Resilient Development:** Despite discovering a Sunday date bug during testing, we resolved it immediately to ensure the "Join Consultation" functionality was delivered on time.

---

### ⚠️ What Went Wrong (Technical Debt & Process Friction)
* **Disconnected Legacy Pages:** While Sprint 3 goals were met, several pages from **previous sprints** (Lecturer Dashboard, Lecturer Availability, Activity Logs) remain in a "UI-only" state.
* **Code Review Bottleneck:** The team identified that the convention requiring two direct code comments per PR was too restrictive, leading to merging delays.
* **Last-Minute Push Pressure:** A significant amount of integration happened in the final hours of the sprint. This "Sunday rush" increased stress levels and left very little room for thorough peer review and final QA.

---

### 🚀 What Can Be Improved
* **Revised Review Convention:** We have updated our style guide: moving forward, reviews require **one direct code comment** and **one summary comment** on the Pull Request to balance speed and quality.
* **Staggered Internal Deadlines:** To avoid last-minute pushes, we are implementing a "Soft Code Freeze" for Sprint 4. All feature work should be pushed by Saturday evening, leaving Sunday strictly for documentation and final bug fixes.
* **Sprint 4 "Wiring" Focus:** No new features will be started in Sprint 4 until the legacy Lecturer and Activity Log modules are fully connected to the database.

---

### 🏁 Conclusion
**Sprint 3 Status: COMPLETED (8/8 Stories).** This sprint was a major win for the student journey. The team has successfully "inspected and adapted" our internal processes regarding code reviews and submission timing. Sprint 4 will focus on bridging the remaining gaps in the Lecturer and Logging modules.