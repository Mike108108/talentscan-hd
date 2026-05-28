import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "../App";
import HrAuthGuard from "../components/hr/HrAuthGuard";
import HrShell from "../components/hr/HrShell";
import CabinetForkPage from "../pages/CabinetForkPage";
import CandidateTalentMapPage from "../pages/hr/CandidateTalentMapPage";
import HrCabinetRedirect from "../pages/hr/HrCabinetRedirect";
import HrCandidateDetailPage from "../pages/hr/HrCandidateDetailPage";
import HrCandidateFormPage from "../pages/hr/HrCandidateFormPage";
import HrCandidatesPage from "../pages/hr/HrCandidatesPage";
import HrCompanyCreatePage from "../pages/hr/HrCompanyCreatePage";
import HrCompanyOverviewPage from "../pages/hr/HrCompanyOverviewPage";
import HrLandingPage from "../pages/hr/HrLandingPage";
import HrLoginPage from "../pages/hr/HrLoginPage";
import HrSignupPage from "../pages/hr/HrSignupPage";
import HrSetupPage from "../pages/hr/HrSetupPage";
import HrVacanciesPage from "../pages/hr/HrVacanciesPage";
import HrVacancyDetailPage from "../pages/hr/HrVacancyDetailPage";
import HrVacancyFormPage from "../pages/hr/HrVacancyFormPage";
import HrReportsPage from "../pages/hr/HrReportsPage";
import HrCompanyDataPage from "../pages/hr/HrCompanyDataPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CabinetForkPage />} />
        <Route path="/app/*" element={<App />} />

        <Route path="/hr" element={<HrLandingPage />} />
        <Route path="/hr/login" element={<HrLoginPage />} />
        <Route path="/hr/signup" element={<HrSignupPage />} />
        <Route path="/hr/setup" element={<HrSetupPage />} />
        <Route path="/hr/company/new" element={<HrCompanyCreatePage />} />
        <Route
          path="/hr/cabinet"
          element={
            <HrAuthGuard>
              <HrCabinetRedirect />
            </HrAuthGuard>
          }
        />
        <Route path="/hr/companies" element={<Navigate to="/hr/cabinet" replace />} />
        <Route
          path="/hr/company/:companyId"
          element={
            <HrAuthGuard>
              <HrShell />
            </HrAuthGuard>
          }
        >
          <Route index element={<HrCompanyOverviewPage />} />
          <Route path="vacancies" element={<HrVacanciesPage />} />
          <Route path="vacancies/new" element={<HrVacancyFormPage />} />
          <Route path="vacancies/:vacancyId" element={<HrVacancyDetailPage />} />
          <Route path="vacancies/:vacancyId/edit" element={<HrVacancyFormPage />} />
          <Route path="reports" element={<HrReportsPage />} />
          <Route path="company" element={<HrCompanyDataPage />} />
          <Route path="candidates" element={<HrCandidatesPage />} />
          <Route path="candidates/new" element={<HrCandidateFormPage />} />
          <Route path="candidates/:candidateId/edit" element={<HrCandidateFormPage />} />
          <Route path="candidates/:candidateId" element={<HrCandidateDetailPage />} />
          <Route path="candidates/:candidateId/talent-map" element={<CandidateTalentMapPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
