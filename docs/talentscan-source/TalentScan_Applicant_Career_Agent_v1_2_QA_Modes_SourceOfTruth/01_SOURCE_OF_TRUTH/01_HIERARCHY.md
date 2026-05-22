# Source-of-truth hierarchy v1.2

Если файлы или правила конфликтуют, использовать этот порядок приоритета:

## Level 1 — Product / Agent identity

1. `00_START_HERE/00_MANIFEST.md`
2. `00_START_HERE/02_SHORT_AGENT_LOGIC.md`
3. `01_PRODUCT_CONTEXT/01_WHAT_IS_TALENTSCAN_APPLICANT.md`
4. `01_PRODUCT_CONTEXT/02_SCOPE_AND_MODES.md`

Это определяет, что агент — для соискателя, а не HR.

## Level 2 — Active rules and prohibitions

1. `02_AGENT_RULES/`
2. `10_DO_NOT_BREAK/`
3. `08_TEAMSCAN_APPLICANT_RULES/`

Это правила поведения агента. Они выше примеров.

## Level 3 — Active design and card etalons

1. `05_ACTIVE_HTML_ETALON/ACTIVE_DARYA_TALENT_MAP_DARK_V1_1_NO_BURGER_LOWFIT.html`
2. `11_HTML_EXAMPLES/EXAMPLE_DARYA_CURRENT_ROLE_KOTOKAFE_DARK_V1_0.html`
3. `11_HTML_EXAMPLES/EXAMPLE_DARYA_VACANCY_BANKIRRO_CLIENT_MANAGER_DARK_V1_0.html`
4. `11_HTML_EXAMPLES/EXAMPLE_ARTUR_DARYA_APPLICANT_COMPATIBILITY_PLAIN_LANGUAGE_V1_0.html`
5. `11_HTML_EXAMPLES/EXAMPLE_DARYA_APPLICANT_CABINET_V1_3_MULTILEVEL.html`

Это активные примеры дизайна, структуры и UX.

## Level 4 — Templates

`06_TEMPLATES/` задаёт обязательные блоки для новых карточек.

## Level 5 — QA

`09_QA_PROTOCOL/` обязателен перед выдачей результата.

## Level 6 — Reference examples

`12_REFERENCE_OUTPUT_EXAMPLES/` и `12_REFERENCE_ONLY_ARCHIVE/` — только справочные материалы. Их нельзя использовать как активную логику, если они конфликтуют с Level 1–5.

## Неактивно в v1.2

- Соционика.
- Старый большой модуль совместимости с любовью/дружбой/семьёй/HR-кандидатами.
- HR-логика “работодатель решает, брать ли кандидата”.
- Любая карточка, где соискатель превращается в объект оценки для работодателя.
