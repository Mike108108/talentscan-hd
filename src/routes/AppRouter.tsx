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
import HrCompaniesPage from "../pages/hr/HrCompaniesPage";
import HrCompanyOverviewPage from "../pages/hr/HrCompanyOverviewPage";
import HrLandingPage from "../pages/hr/HrLandingPage";
import HrLoginPage from "../pages/hr/HrLoginPage";
import HrSignupPage from "../pages/hr/HrSignupPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CabinetForkPage />} />
        <Route path="/app/*" element={<App />} />

        <Route path="/hr" element={<HrLandingPage />} />
        <Route path="/hr/login" element={<HrLoginPage />} />
        <Route path="/hr/signup" element={<HrSignupPage />} />
        <Route
          path="/hr/cabinet"
          element={
            <HrAuthGuard>
              <HrCabinetRedirect />
            </HrAuthGuard>
          }
        />
        <Route
          path="/hr/companies"
          element={<HrCompaniesPage />}
        />
        <Route
          path="/hr/company/:companyId"
          element={
            <HrAuthGuard>
              <HrShell />
            </HrAuthGuard>
          }
        >
          <Route index element={<HrCompanyOverviewPage />} />
          <Route path="candidates" element={<HrCandidatesPage />} />
          <Route path="candidates/new" element={<HrCandidateFormPage />} />
          <Route path="candidates/:candidateId/edit" element={<HrCandidateFormPage />} />
          <Route path="candidates/:candidateId" element={<HrCandidateDetailPage />} />
        </Route>
        <Route
          path="/hr/company/:companyId/candidates/:candidateId/talent-map"
          element={
            <HrAuthGuard>
              <CandidateTalentMapPage />
            </HrAuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
