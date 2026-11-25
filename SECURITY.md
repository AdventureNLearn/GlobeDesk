# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.4.1 (this tree, Atlas) | Yes — report against the tree you are running |
| 1.3.x | Yes |
| < 1.3 | No. Please update. |

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

Report it privately through GitHub: go to **Security → Report a vulnerability** on [AdventureNLearn/GlobeDesk](https://github.com/AdventureNLearn/GlobeDesk/security/advisories/new).

Include the steps to reproduce, the browser and version, and what an attacker could do. Response times are best effort.

## Threat model in brief

- GlobeDesk runs entirely in the browser. There is no GlobeDesk server, account or telemetry.
- Media, autosave and the Archive live in the browser's IndexedDB. Optional keys live in `localStorage`.
- Untrusted input includes imported episode JSON, project packs, `?import=` paths (same-origin `/episodes/` only), `postMessage`, pasted assistant output and uploaded files. All of them are validated or sanitized.
- Network access is limited by the Content-Security-Policy to the map, tile and embed hosts listed in `GROK-ME-BUILD.md`.

Issues in third-party services (map tiles, embeds) should go to those providers.
