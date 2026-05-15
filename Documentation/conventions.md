# Project Conventions

## 1. Naming Conventions Guide
To maintain a professional codebase and satisfy the "Excellent" criteria for well-written documentation, we adhere to the following:

* **HTML/CSS IDs**: Use **kebab-case** (e.g., `<button id="cancel-consultation-btn">`).
* **CSS Classes**: Use **snake_case** (e.g., `.dashboard_container_main`). 
* **JavaScript Variables/Functions**: Use **camelCase** (e.g., `const lecturerAvailability = ...`).
* **Database Models**: Use **PascalCase** (e.g., `UserAccount`).
* **File Naming**: Use **kebab-case** (e.g., `login-handler.js`).

## 2. Code Review & Pull Request Guide
 * **Peer Reviews**: No code merged to trunk (main) without a review of the code by at least one other different group member. 
 * **Review Criteria**: Reviewers must adhere to the naming convention and logic correctness. 
 * **Comment**: There should be at least one direct code comment and one summary comment per Pull Request (Comment about at least one things about the code and the overall code). 

 ## 3. Commit Messages 
 We are following the Angular Standard for committing messages which is: 
* `feat:` (for new features added) e.g., `feat: Added new page for booking`
* `fix:` (for bug fixes)  e.g., `fix: fixed problem with submit button`
* `docs:` (for changes in documentation) e.g., `docs: further clarified the naming conventions in convention.md`
* `refactor:` (for code cleanup) e.g., `refactor: refactored code in xxxx.js to about submittings`
