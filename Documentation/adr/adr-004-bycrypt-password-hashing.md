# ADR 004: Bcrypt Password Hashing

## Status
Accepted

## Context
The Synchro consultation scheduler handles authentication for two distinct user roles: students and lecturers. Storing user passwords in plaintext within a persistent database layer introduces critical security vulnerabilities, exposing user accounts to unauthorized access in the event of a database breach. Furthermore, the ELEN4010 grading rubric explicitly states that to achieve Good and Excellent ratings, the application must implement industry-standard web security practices, specifically password hashing. The chosen solution must automatically handle cryptographic salting to neutralize rainbow table attacks and provide a customizable work factor to resist hardware-accelerated brute-force attempts.

## Decision
We will implement the Bcrypt cryptographic library to hash and salt user passwords before they are committed to long-term storage, utilizing a workload factor of 10 salt rounds.

## Justification
Implementing Bcrypt provides an essential layer of defensive security that directly addresses the rigorous technical standards. Standard architectural alternatives, such as SHA-256 or MD5, are designed to be computationally fast, making them highly vulnerable to modern GPU-accelerated brute-force sorting attacks and precomputed rainbow table lookups. 

Bcrypt structurally mitigates this vulnerability by natively generating a unique, randomized cryptographic salt for every individual account creation. This ensures that even if a student and a lecturer select identical password characters, their long-term storage string representations remain entirely distinct, preventing profile pattern matching. Furthermore, its underlying key-derivation design relies on a configurable workload factor. By locking our system execution to 10 rounds, we balance hardware processing overhead perfectly; the minor delay is completely imperceptible to a legitimate user logging into their dashboard, but it drastically raises the processing cost for an attacker attempting offline credential optimization.

## Consequences

**Positive:**
* Complete alignment with the security criteria outlined in the project evaluation rubric for higher-tier grading.
* High resistance to brute-force and dictionary attacks due to Bcrypt's deliberate, computationally slow adaptive hashing design.
* Built-in salting mechanisms ensure that identical user passwords yield completely unique hashes in the database, eliminating the risk of pattern matching.
* Simple asynchronous API integration within our existing Express registration and login controller workflows.

**Negative:**
* Hashing introduces a minor processing delay during the registration and authentication lifecycles due to the computational intensity of the algorithm.
* Requires careful dependency management, as the native implementation of Bcrypt compiles binary binaries which must be kept compatible across different developer operating systems and the remote production deployment environment.