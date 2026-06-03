# Talent Map — Layer Architecture v0.2 (Stage 4.7)

Spec-only document. Production **12-layer core-layers** generation is unchanged (see `netlify/functions/hr-talent-map-v2-core-layers-shared.ts` → `CORE_LAYERS_ORDER`).

Canonical constants: [`talentMapLayerArchitecture.ts`](./talentMapLayerArchitecture.ts).

## Principle

| Layer | Role |
| --- | --- |
| **34 legacy methodology layers** + `chart_passport` | Internal **evidence / source signal** catalog (`EVIDENCE_SIGNAL_CATALOG_V0_2`) |
| **16 AI narrative product layers** | HR-facing `layer_reports` target (`PRODUCT_LAYER_CATALOG_V0_2`) |
| **`data_quality`** | System QA / evidence layer — not a full AI narrative layer by default |
| **6 synthesis blocks** | Shown first in HR UI; assembled from product layers |
| **Role-fit (future)** | Compare `matching_summary` ↔ vacancy `requirement_summary`, not full layer prose |

## Product layers (16 + system)

1. `work_format` — Рабочий формат  
2. `task_entry` — Вход в задачи  
3. `decision_style` — Принятие решений  
4. `work_signature` — Рабочий почерк  
5. `inner_coherence` — Внутренняя связность  
6. `stability_and_risk_zones` — Устойчивость и зоны перегруза *(merges runtime `stable_zones` + `sensitive_zones`)*  
7. `talent_links` — Связки талантов  
8. `point_talents_and_strong_themes` — Точечные таланты и усиленные темы *(merges `point_talents` + `amplified_themes`)*  
9. `main_work_axis` — Главная рабочая ось *(merges `conscious_axis` + `background_axis`)*  
10. `communication_style` — Коммуникация и объяснение *(planned)*  
11. `values_and_culture` — Ценности и культура взаимодействия *(planned)*  
12. `growth_tension` — Напряжение и рост *(planned)*  
13. `responsibility_and_rules` — Ответственность, правила и зрелость *(planned; absorbs legacy `principles_and_rules`, `responsibility_maturity`)*  
14. `work_environment_and_recovery` — Рабочая среда и восстановление *(planned; no medical/dietary advice)*  
15. `motivation_and_focus` — Мотивация и фокус *(planned)*  
16. `team_contribution_type` — Тип вклада в команду *(planned)*  

**System:** `data_quality` — Надёжность данных.

## Runtime 12 → product v0.2

| Runtime (today) | Product v0.2 |
| --- | --- |
| `work_format` | `work_format` |
| `task_entry` | `task_entry` |
| `decision_style` | `decision_style` |
| `work_signature` | `work_signature` |
| `inner_coherence` | `inner_coherence` |
| `stable_zones` | `stability_and_risk_zones` |
| `sensitive_zones` | `stability_and_risk_zones` |
| `talent_links` | `talent_links` |
| `point_talents` | `point_talents_and_strong_themes` |
| `amplified_themes` | `point_talents_and_strong_themes` |
| `conscious_axis` | `main_work_axis` |
| `background_axis` | `main_work_axis` |

Mapping constant: `RUNTIME_CORE_LAYER_TO_PRODUCT_LAYER_V02`.

## Synthesis blocks → layers

| Block | Product layers (+ system) |
| --- | --- |
| `executive_summary` | work_format, task_entry, decision_style, work_signature, main_work_axis, talent_links, point_talents_and_strong_themes, stability_and_risk_zones, work_environment_and_recovery, **data_quality** |
| `work_formula` | work_format, task_entry, decision_style, work_signature, inner_coherence, main_work_axis, talent_links, motivation_and_focus |
| `talents` | talent_links, point_talents_and_strong_themes, main_work_axis, communication_style, values_and_culture, team_contribution_type |
| `work_environment` | work_environment_and_recovery, inner_coherence, stability_and_risk_zones, motivation_and_focus, task_entry, decision_style |
| `risks` | stability_and_risk_zones, growth_tension, responsibility_and_rules, motivation_and_focus, work_environment_and_recovery, **data_quality** |
| `management` | task_entry, decision_style, work_signature, inner_coherence, stability_and_risk_zones, work_environment_and_recovery, responsibility_and_rules, growth_tension, values_and_culture |

Constant: `SYNTHESIS_BLOCK_LAYERS_V02`.

## Future role-fit (vacancy areas → product layers)

| Vacancy area | Product layers |
| --- | --- |
| `vacancy.responsibilities` | talent_links, point_talents_and_strong_themes, main_work_axis |
| `vacancy.work_format` | work_format, task_entry, decision_style |
| `vacancy.manager_context` | work_signature, inner_coherence, stability_and_risk_zones, responsibility_and_rules |
| `vacancy.communication_requirements` | communication_style, values_and_culture |
| `vacancy.culture` | values_and_culture, team_contribution_type |
| `vacancy.pressure_level` | stability_and_risk_zones, growth_tension, motivation_and_focus |
| `vacancy.environment` | work_environment_and_recovery, motivation_and_focus |
| `vacancy.risk_conditions` | growth_tension, stability_and_risk_zones, responsibility_and_rules |

Constant: `VACANCY_REQUIREMENT_TO_PRODUCT_LAYERS_V02`.

## Legacy catalog location

The pre-v0.2 **35-entry** UI fallback catalog lives in `src/pages/hr/talentMapPanelContent.tsx` (`LAYER_CATALOG_FALLBACK`). Stage 4.7 does not change that UI catalog or wire v0.2 into generation.

## Stage 4.8+ (out of scope here)

- Generate 7 planned product layers + system `data_quality` narrative/evidence as needed  
- Merge runtime 12 reports into 9 product layer reports for display  
- Update synthesis builder to use `SYNTHESIS_BLOCK_LAYERS_V02`  
- Role-fit using `VACANCY_REQUIREMENT_TO_PRODUCT_LAYERS_V02` + `matching_summary`
