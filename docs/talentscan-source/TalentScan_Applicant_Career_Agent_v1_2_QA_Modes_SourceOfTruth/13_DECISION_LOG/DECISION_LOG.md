# Decision Log — Applicant Agent

## v1.1

- Создана чистая база агента для соискателя.
- Активный дизайн переведён на карту Дарьи.
- Соционика не интегрирована.
- TeamScan очищен от большого старого compatibility pack.
- Добавлена source-of-truth hierarchy.

## v1.2

- Добавлены режимы работы: Development Mode и Test Mode.
- По умолчанию агент находится в режиме разработки.
- Тестовый режим включается только явной командой пользователя.
- Усилено правило независимости кейсов: новый бодиграф / новая роль / новая вакансия / новый руководитель не наследуют прошлый контекст.
- Добавлены QA-протоколы для каждого типа карточки:
  - Talent Map;
  - Current Role;
  - Vacancy Assessment;
  - Comparison;
  - Working Environment;
  - Applicant Compatibility;
  - Applicant Cabinet;
  - PDF Export.
- Добавлены свежие эталонные карточки:
  - текущая роль Дарьи: котокафе;
  - вакансия БАНКИРРО;
  - простая совместимость Артур × Дарья для соискателя;
  - кабинет Дарьи v1.3.
- Техническая HD-совместимость перемещена в reference-only archive.
- Активная логика: соискатель проверяет среду, роль, руководителя и свои условия раскрытия.


## v1.2 patch — Active Vacancy Assessment Etalon

- Version name remains v1.2.
- Added `11_HTML_EXAMPLES/EXAMPLE_MIKHAIL_ONESUMMER_VACANCY_ASSESSMENT_V2_SELF_PRESENTATION.html`.
- This file is now the active etalon for all future `VACANCY_ASSESSMENT` / “соответствие вакансии” cards in Applicant / Career Agent.
- Mandatory logic added for vacancy-fit cards: applicant-facing assessment + conditions + employer questions + decision matrix + self-presentation/interview positioning block.
- Do not transfer Mikhail, OneSummer or that specific vacancy data into new cases. Transfer only structure, UX logic, applicant framing and mandatory blocks.
