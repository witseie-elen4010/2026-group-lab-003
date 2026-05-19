# ADR 007: Bootstrap Frontend Framework

## Status
Accepted

## Context
The Synchro consultation scheduler requires a responsive, clean, and intuitive user interface accessible by both students and lecturers across desktop and mobile browsers. Section 3.3 of the technical requirements explicitly mandates the use of the Bootstrap component library for the front-end interface, while strictly forbidding the use of client-side frameworks such as React, Angular, or Vue. We needed to ensure that we could build a polished, multi-dashboard user experience that communicates directly with our Express backend template or static routing structures without writing massive amounts of custom CSS from scratch.

## Decision
We will use HTML5 and vanilla JavaScript styled exclusively with the Bootstrap component library for our frontend user interface.

## Justification
Using Bootstrap ensures complete compliance with the functional and process constraints defined in the laboratory brief. Because our sprint cycles are limited to one week, building a fully responsive grid system and styled UI components (like navigation bars, form inputs for availability settings, and tabular layouts for the system log) from raw CSS would create an immense time bottleneck. 

Bootstrap allows us to rapidly prototype our student and lecturer dashboards using clean, pre-built utility classes. Since we are restricted to a standard server-side or static asset delivery model without a virtual DOM (like React), Bootstrap integrates perfectly with standard HTML templates. It gives our application a unified, professional theme out-of-the-box, ensuring we hit the "polished user experience" criteria in the rubric while maintaining minimal frontend styling overhead.

## Positives
* Absolute adherence to the strict front-end framework limitations outlined in the project brief.
* Drastically accelerates UI development and form design, allowing the group to focus engineering efforts on complex backend scheduling logic.
* Built-in mobile responsiveness ensures that the dashboard grids dynamically adapt to mobile viewports for on-the-go student bookings.
* Eliminates the need to manage complex front-end build pipelines, bundlers, or compilation steps.

## Negatives
* Relies heavily on the default Bootstrap visual theme, requiring extra utility styling overrides to give the Synchro platform a unique, distinct visual identity.
* Including the full Bootstrap CSS and JS distribution introduces minor unnecessary bloat for components and styles that our application does not actively utilize.