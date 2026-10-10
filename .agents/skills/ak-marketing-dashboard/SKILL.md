---
name: ak:marketing-dashboard
description: Run and inspect the local Assets, Brand, and Settings dashboard.
user-invocable: true
when_to_use: "Invoke to run or inspect the local assets, brand, and settings dashboard."
category: marketing
keywords: [dashboard, assets, brand, settings, local]
argument-hint: "[start|stop|status|open]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Marketing Dashboard

Use this skill for the local marketing asset and brand dashboard.

On first operation, read [README.md](./README.md). For subsequent actions, use
[Start And Stop](./README.md#start-and-stop),
[Configuration](./README.md#configuration), or
[Troubleshooting](./README.md#troubleshooting) as needed. That file is the
single dashboard documentation authority for current features, routes, storage,
commands, configuration, validation, and troubleshooting. Do not infer
campaign, content-generation, automation, or authentication behavior from the
skill name or earlier versions.

Resolve this installed skill's directory through the runtime's live skill
catalog before running any referenced script. Report the URLs printed by the
script and surface any SQLite driver remediation verbatim.

Before starting, inspect existing project processes and reuse the matching one. Track PID, port, and project for processes you start. Keep local use on loopback and inspect the actual bind behavior; the README does not establish active authentication. Before stopping, verify ownership: the stop helper can fall back to killing by port, so do not run that path against unrelated listeners.
