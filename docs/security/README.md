# Security

Platform security for the homelab — supply chain, admission control, secrets.

| Doc | Topic |
| --- | ----- |
| [Supply chain & policies](supply-chain-and-policies.md) | Cosign, Trivy, Syft, Harbor, Kyverno (vs OPA) |
| [Wazuh (SIEM/XDR)](wazuh.md) | Where Wazuh fits vs Prometheus, Falco, Kyverno |

**Phase mapping:** Harbor (8) → CI signing (8b) → Kyverno + Falco (9) → **Wazuh** (11+).

See also [roadmap/phases.md](../roadmap/phases.md) §8–9.
