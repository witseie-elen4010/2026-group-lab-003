# ADR 003: Use Bcrypt for Password Hashing

## Status
Accepted

## Context
We need to store user credentials. Storing passwords in plain text is a security risk.

## Decision
We will use the `bcrypt` library to salt and hash passwords.

## Rationale
* **Salting:** Prevents identical passwords from having the same hash.
* **Work Factor:** 10 salt rounds provides a balance of speed and security.

## Consequences
* **Positive:** Secure storage of credentials.
* **Negative:** CPU overhead for hashing; passwords cannot be recovered, only reset.