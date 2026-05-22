# Decision Log — TalentScan_HR_Employer_Agent_v1_0

## v1.0 — split agents

Создан отдельный пакет агента: `TalentScan_HR_Employer_Agent_v1_0`.

Решение:

- больше не держать HR/Employer и Applicant/Career логику в одном агенте;
- полный общий контекст TalentScan зашит внутрь каждого пакета;
- отдельного Shared Core ZIP не делать;
- активный дизайн всех карточек — dark/plain `talentscan_olga_career_profile_plain_dark_v2_mobile_fixed_menu.html`;
- настройки подачи смысла добавлены в пакет;
- правила композитов / TeamScan добавлены в пакет;
- TeamScan использовать только в рамках аудитории агента;
- HTML по умолчанию, PDF только по прямой просьбе.
