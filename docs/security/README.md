# Secure the Homelab from Supply Chain to Runtime

Security here means a chain you can explain in an interview: scan and sign at build, admit only good manifests at deploy, and watch hosts and security events at runtime. It is not a single product drop-in.

Phases stack on purpose: Harbor (8) → CI signing (8b) → Kyverno + Falco (9) → Wazuh (11+). Details live in [roadmap/phases.md](../roadmap/phases.md) §8–9.

## What this page covers

- Index of supply-chain/policy and Wazuh docs
- Phase order for registry, signing, admission, SIEM
- How these pieces relate without overlapping jobs

| Doc | Topic |
| --- | ----- |
| [Supply chain & policies](supply-chain-and-policies.md) | Cosign, Trivy, Syft, Harbor, Kyverno (vs OPA) |
| [Wazuh (SIEM/XDR)](wazuh.md) | Where Wazuh fits vs Prometheus, Falco, Kyverno |
