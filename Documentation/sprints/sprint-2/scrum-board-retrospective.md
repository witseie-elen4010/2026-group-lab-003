# 📌 Sprint 2 Report

**📅 Date of Meeting:** 2026-05-03  
**👥 Team:** Group-003  

---

### 📊 Sprint Summary
* **Number of user stories planned:** 8
* **Number of user stories completed/delivered:** 8 
* **Sprint Outcome:** We achieved a 100% completion rate for our planned stories. The application is now fully interconnected, moving from isolated pages to a cohesive, navigable user journey with dynamic data integration.

---

### ✅ What Went Well
* **Perfect Velocity & Scoping:** We accurately estimated our workload this week, successfully delivering all 8 planned stories without burning out or needing to carry work over.
* **Successful Cleanup Spike:** We acted on last week's feedback immediately. Asset pathing issues and MIME type errors on our Render deployment were resolved, and the navigation flow between the Landing, Login, and Dashboards is now seamless.
* **Improved Integration Habits:** The team pushed code more frequently and integrated earlier in the sprint, successfully avoiding the "integration hell" we experienced at the end of Sprint 1.

---

### ⚠️ What Went Wrong
* **API & Frontend Mismatches:** There were a few instances where the data structure expected by the frontend did not perfectly match the backend API response, requiring quick hotfixes and extra communication.
* **Test Data Consistency:** As we moved from static UI to database-driven features, developers experienced minor friction keeping their local database environments seeded with the same test data, slowing down manual testing. 
* **Date Logic Test Failure:** One of our tests began failing because the implemented scheduling logic only accounted for weekdays and broke when handling weekend dates. We have logged this bug, and it will be prioritized and fixed as early as possible in Sprint 3.

---

### 🚀 What Can Be Improved
* **Define Strict API Contracts:** Before building frontend components, we need to agree on the exact JSON structures the backend will return. This will prevent integration bugs and save debugging time.
* **Standardize Database Seeding:** Create a shared seed script so that every team member can instantly populate their local database with the exact same test data. 
* **Edge-Case Testing:** Now that the "happy path" is working and fully connected, we need to dedicate more time to handling edge cases, such as incorrect inputs, missing data, and boundary dates (like the weekend logic bug).

---

### 🏁 Conclusion
**Sprint 2 Status: COMPLETED.** The app is now fully connected with functioning data flows. Sprint 3 will focus on building out the core consultation engine, specifically implementing student booking controls (issuing, joining, and canceling sessions) and advanced lecturer availability features (such as setting maximum student capacities per consultation).