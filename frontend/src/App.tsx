import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import EmailManagerPage from './pages/EmailManagerPage';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import ReportsPage from './pages/ReportsPage';
import ManualTriggerPage from './pages/ManualTriggerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="emails" element={<EmailManagerPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="properties/:id" element={<PropertyDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="trigger" element={<ManualTriggerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
