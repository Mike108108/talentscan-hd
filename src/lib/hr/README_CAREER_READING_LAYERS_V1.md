# HD Career Reading Layers v1

Contract-first stage **4.10-A**: eight canonical career-reading layers for the HR candidate talent map.  
Constants and types: [`careerReadingLayersV1.ts`](./careerReadingLayersV1.ts).  
Prompt skeletons (not in production): [`netlify/functions/hr-career-reading-layer-prompts-v1.ts`](../../../netlify/functions/hr-career-reading-layer-prompts-v1.ts).

## 1. Why move from 16/19 small layers to 8 large layers

Production today works as:

```text
19 runtime generation steps
→ Product Layer Adapter v0.2
→ 16 product narrative layers + data_quality
→ Synthesis Blocks v0.1
```

That pipeline is stable, but the product surface is too fragmented for a **classical Human Design career reading**: HR users need a readable “career reveal map”, not many thin slices that repeat the same synthesis fragments.

Career Reading Layers v1 groups chart signals into **eight HR-meaningful chapters** aligned with classic HD career interpretation (work mode, profile style, conscious/background themes, channels, repeated gates, centers, environment). Each layer still exposes **Base / Pro / evidence / summary_for_synthesis / matching_summary** for dashboard, synthesis, role-fit, and export in later stages.

This PR adds **contract + mapping + prompt skeleton only**. It does **not** replace runtime 19-layer generation or change the production UI.

## 2. The eight layers

| `layer_key` | HR title | Role |
| --- | --- | --- |
| `work_mode_and_decisions` | Рабочий формат и решения | Format, task entry, decisions, correct inclusion, entry risks |
| `profile_work_style` | Рабочий почерк | How the person shows up, learns, earns trust, adapts |
| `conscious_work_theme` | Сознательная рабочая тема | Main conscious work theme (Personality Sun/Earth) |
| `background_work_pattern` | Фоновый рабочий паттерн | Background/unconscious work pattern (Design Sun/Earth) |
| `talent_channels` | Устойчивые связки талантов | One talent card **per channel** |
| `repeated_themes` | Усиленные рабочие мотивы | Repeated gate themes (not all gates) |
| `centers_stability_and_sensitivity` | Устойчивые и чувствительные зоны | Defined vs open/sensitive centers |
| `environment_focus_and_motivation` | Среда, фокус и условия раскрытия | Supporting context: environment, variables, cognition |

## 3. `normalized_chart_data` sources per layer

See `CAREER_READING_LAYER_CATALOG_V1` and `buildCareerReadingLayerInputsV1()`:

- **work_mode_and_decisions**: `type`, `strategy`, `authority`, `signature`, `notSelfTheme`
- **profile_work_style**: `profile`, `definition`, Personality/Design Sun (+ lines)
- **conscious_work_theme**: `activations.personality.sun`, `activations.personality.earth`
- **background_work_pattern**: `activations.design.sun`, `activations.design.earth`
- **talent_channels**: `channelsShort`, `channelsLong`, `circuitries`, optional `channelObjects`
- **repeated_themes**: `gatesBoth`, `gateSources`, optional `strongGateSignals`
- **centers_stability_and_sensitivity**: `definedCenters`, `openCenters`, optional `centers`
- **environment_focus_and_motivation**: `environment`, `motivation`, `transference`, `perspective`, `distraction`, `cognition`, `determination`, `variables`, nodes from activations when present

## 4. Base (client HR language)

Base is written for recruiters and managers **without** HD terminology. Forbidden as primary language in Base include: Human Design, bodygraph, gates/channels/centers, Type/Strategy/Authority/Profile labels, Generator/Projector/Manifestor/Reflector, Gene Keys, socionics, etc.

Base should use applied phrases: рабочий формат, вход в задачи, принятие решений, рабочий почерк, рабочая тема, фоновый паттерн, связки талантов, усиленные мотивы, устойчивые/чувствительные зоны, условия раскрытия, что проверить, как управлять.

## 5. Pro (classical HD traceability)

Pro answers: **on which technical chart data is this HR conclusion built?**

It must list `classical_sources` with Type, Strategy, Authority, Profile, Definition, Centers, Channels, Gates, Planets, Activations, Personality/Design, Lines, Variables, Environment, Motivation, etc. Pro may include gate/channel codes (e.g. channel `11-56`) even when Base must not.

## 6. `summary_for_synthesis`

Each `CareerReadingLayerReportV1` includes a compact `summary_for_synthesis`:

- `one_sentence`, `strengths`, `risks`, `conditions`, `management_focus`, `what_to_check`

Designed for a **follow-up synthesis API** (replacing long concatenations from 16 small product layers). Short, non-redundant, no hire verdict.

## 7. `matching_summary`

Each layer also exposes `matching_summary`:

- `good_for`, `bad_for`, `role_fit_positive_signals`, `role_fit_risk_signals`, `check_in_role_fit`

Short HR-language signals for **future role-fit** comparison to vacancy requirements — not a hire score and not part of the main candidate map narrative.

## 8. `talent_channels`: one card per channel

This is a **single layer** with `special_payload.channel_talents[]`:

- 1 channel → 1 `CareerReadingChannelTalentV1`
- N channels → N cards
- 0 channels → honest empty-state in Base; do not invent channels

## 9. `centers_stability_and_sensitivity`: one card per zone

Split into **defined** (`defined_zones`) and **open/sensitive** (`open_sensitive_zones`). Each center is a separate `CareerReadingCenterZoneV1` in `special_payload.center_zones`.

## 10. `repeated_themes` ≠ all `gatesAll`

Only amplified/repeated signals:

- `gatesBoth`
- gates with multiple entries in `gateSources`
- optional `strongGateSignals` when present on chart payload

Do **not** iterate every gate in `gatesAll` — that produces unreadable noise.

## 11. Environment layer is supporting, not primary

`environment_focus_and_motivation` refines conditions (environment, motivation, transference, perspective, distraction, cognition, determination, variables). It must **not** dominate the map or give medical/dietary/categorical life advice.

## 12. Role-fit is out of scope for the general map

Role-fit compares `matching_summary` (and vacancy context) to a **specific vacancy**. It belongs in a separate flow, not in the eight-layer career reading that describes the person independent of a job posting.

## Related (unchanged in 4.10-A)

- Runtime 19-layer generation: `netlify/functions/hr-talent-map-v2-core-layers-shared.ts`
- Product layers: [`productLayerAdapter.ts`](./productLayerAdapter.ts), [`README_LAYER_ARCHITECTURE_V0_2.md`](./README_LAYER_ARCHITECTURE_V0_2.md)
- Synthesis blocks: [`synthesisBlocksV01.ts`](./synthesisBlocksV01.ts)

## Stage 4.10-B (next)

Read before implementation:

1. [`careerReadingLayersV1.ts`](./careerReadingLayersV1.ts) — types, catalog, `buildCareerReadingLayerInputsV1`
2. [`hr-career-reading-layer-prompts-v1.ts`](../../../netlify/functions/hr-career-reading-layer-prompts-v1.ts) — prompt skeleton
3. This README

Then wire generation (still behind a feature flag), validate Base/Pro QA, and connect summaries to synthesis/dashboard without removing legacy 19-layer path.
