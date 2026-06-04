# Talent Map — Layer Architecture v0.2

Canonical constants: [`talentMapLayerArchitecture.ts`](./talentMapLayerArchitecture.ts).

Production pipeline: `netlify/functions/hr-talent-map-v2-core-layers-shared.ts` → `CORE_LAYERS_ORDER` (19 runtime layers).

## Principle

| Layer | Role |
| --- | --- |
| **34 legacy methodology layers** + `chart_passport` | Internal **evidence / source signal** catalog (`EVIDENCE_SIGNAL_CATALOG_V0_2`) |
| **16 AI narrative product layers** | HR-facing product view (`PRODUCT_LAYER_CATALOG_V0_2`), adapted from runtime via Product Layer Adapter v0.2 |
| **`data_quality`** | System QA / evidence layer |
| **6 synthesis blocks** | Top HR UI sections; deterministic v0.1 from product layers (`synthesisBlocksV01.ts`) |
| **Role-fit (future)** | Compare `matching_summary` ↔ vacancy `requirement_summary`, not full layer prose |

## Runtime generation (19 steps)

12 source/core layers + 7 product narrative layers:

`work_format`, `task_entry`, `decision_style`, `work_signature`, `inner_coherence`, `stable_zones`, `sensitive_zones`, `talent_links`, `point_talents`, `amplified_themes`, `conscious_axis`, `background_axis`, `communication_style`, `values_and_culture`, `growth_tension`, `responsibility_and_rules`, `work_environment_and_recovery`, `motivation_and_focus`, `team_contribution_type`.

Constant: `RUNTIME_CORE_LAYER_KEYS`.

## Product layers (16 + system)

See `PRODUCT_LAYER_CATALOG_V0_2`. Merged product layers:

- `stability_and_risk_zones` ← `stable_zones` + `sensitive_zones`
- `point_talents_and_strong_themes` ← `point_talents` + `amplified_themes`
- `main_work_axis` ← `conscious_axis` + `background_axis`

Adapter: `adaptRuntimeLayersToProductLayersV02` in [`productLayerAdapter.ts`](./productLayerAdapter.ts).

## Runtime → product mapping

Constant: `RUNTIME_CORE_LAYER_TO_PRODUCT_LAYER_V02` / `PRODUCT_LAYER_TO_RUNTIME_CORE_LAYERS_V02`.

## Synthesis blocks → product layers

| Block | Product layers (+ system) |
| --- | --- |
| `executive_summary` | work_format, task_entry, decision_style, work_signature, main_work_axis, talent_links, point_talents_and_strong_themes, stability_and_risk_zones, work_environment_and_recovery, **data_quality** |
| `work_formula` | work_format, task_entry, decision_style, work_signature, inner_coherence, main_work_axis, talent_links, motivation_and_focus |
| `talents` | talent_links, point_talents_and_strong_themes, main_work_axis, communication_style, values_and_culture, team_contribution_type |
| `work_environment` | work_environment_and_recovery, inner_coherence, stability_and_risk_zones, motivation_and_focus, task_entry, decision_style |
| `risks` | stability_and_risk_zones, growth_tension, responsibility_and_rules, motivation_and_focus, work_environment_and_recovery, **data_quality** |
| `management` | task_entry, decision_style, work_signature, inner_coherence, stability_and_risk_zones, work_environment_and_recovery, responsibility_and_rules, growth_tension, values_and_culture |

Constants: `SYNTHESIS_BLOCK_LAYERS_V02`, `SYNTHESIS_BLOCK_PRODUCT_LAYERS_V02`.

Builder (Stage 4.9-A): `buildSynthesisBlocksFromProductLayersV01` in [`synthesisBlocksV01.ts`](./synthesisBlocksV01.ts) — deterministic, no AI synthesis prompts.

## Future role-fit

Constant: `VACANCY_REQUIREMENT_TO_PRODUCT_LAYERS_V02`.

## Legacy catalog location

The pre-v0.2 **35-entry** UI fallback catalog lives in `src/pages/hr/talentMapPanelContent.tsx` (`LAYER_CATALOG_FALLBACK`).
