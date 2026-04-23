# Security Policy

## Supported Versions

This project is under active development and follows a rolling release model. Only the latest version on the `main` branch is supported with security updates.

| Version       | Supported          |
| ------------- | ------------------ |
| Latest (main) | :white_check_mark: |
| Older commits | :x:                |

Users are strongly encouraged to pull the latest version regularly to receive security patches and improvements.

---

## Security Considerations

R2D2 is a **locally hosted AI agent** that can execute system-level actions (e.g., file operations, command execution). Because of this:

* Do **NOT** expose this application to the public internet
* Do **NOT** run with elevated/admin privileges unless required
* Carefully review any new tools or plugins before enabling them
* Be cautious when allowing the agent to execute dynamic or generated commands

This project is intended for **local development and controlled environments only**.

---

## Reporting a Vulnerability

If you discover a security vulnerability, report it responsibly:

* Submit a report via GitHub Issues (mark it clearly as “SECURITY”)
* Or email directly (add your email here if you want private reporting)

### Include in your report:

* Description of the vulnerability
* Steps to reproduce
* Potential impact
* Suggested fix (if available)

---

## Response Timeline

* Initial acknowledgment: within **48 hours**
* Status update: within **3–5 business days**
* Resolution timeline: depends on severity and complexity

---

## Disclosure Policy

* Valid vulnerabilities will be investigated and patched as quickly as possible
* You may be asked to keep details private until a fix is released
* Once resolved, a summary may be published for transparency

---

## Out of Scope

The following are **not considered security vulnerabilities**:

* Issues requiring physical/local machine access
* Misuse of the tool outside intended local environment
* Performance or non-security-related bugs

---

## Final Note

This is an experimental AI agent system. You are responsible for how you deploy and use it. Improper configuration or unsafe usage may introduce risks.

---
