# Why the lint engine does not use VLM critique

The project ships a deterministic lint engine for UI evaluation (axe-core, APCA, custom token-consistency, custom spacing-scale, custom semantic-HTML). The decision to use deterministic checks rather than a vision-language model (VLM) as a critic is evidence-based.

## The evidence (mid-2026)

Three sources, all live-verified:

1. **UICrit (Yang et al., 2024, arXiv:2407.08850).** Of 5,927 zero-shot UI critiques produced by Gemini across the named categories (color contrast, layout/spacing, text readability), 776 were validated by expert designers as actually correct — **13.1% valid, ~87% noise**. The failure rate is not a capability gap that prompt engineering closes.

2. **VisJudge-Bench (Zhang et al., 2025, arXiv:2510.22373, ICLR 2026).** On the design-quality dimension across data visualizations, the strongest off-the-shelf frontier VLMs reach human-correlation of:
   - GPT-5: 0.429
   - Claude-4-Sonnet: 0.470
   - GPT-4o: 0.482

   No off-the-shelf frontier VLM clears a usable threshold (the working proxy in the literature is ~0.7).

3. **MM-StyleBench (Yang et al., 2025, arXiv:2501.09012).** Base-prompted Claude 3.5 scored Spearman ρ = −0.26 on aesthetic ranking; zero-shot chain-of-thought *degraded* performance by ~22%. Only structured prompting (ArtCoT) lifted scores to 0.58–0.70. The capability is coaxed, not reliable.

## Why the gap is structural

Of the four named evaluation categories, ~80% is deterministic and more accurate than any VLM:

- **Contrast** is closed-form WCAG ratio and APCA Lc math on two colors.
- **Token consistency** is static linting of computed styles against a token table.
- **On-scale spacing** is deterministic from computed margins and gap values.
- **Accessibility** is ~57% auto-detectable by issue volume with near-zero false positives (axe-core covers ~300 WCAG-related rules).

The genuine vision residue — hierarchy, gestalt, balance — is precisely where VLMs score below 0.3.

**Where a VLM is reliable it is unnecessary. Where it is needed it fails.**

## Implementation choice

The lint engine uses deterministic checks as the primary evaluation layer. VLM critique is not integrated at any tier. If a future tier adds a learned critic, the right shape is a small fine-tuned model (e.g. VisJudge-Qwen2.5-VL-7B at 0.681 correlation), not a frontier VLM, and the integration must be harness-side, not in the request hot path.

## See also

- `docs/security/threat-model.md` — threat model for what the deterministic lint does and does not catch.
- `docs/contributing/augmentation-system.md` — how the lint engine integrates with the augmentation system.
