import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import { LandingPage } from './pages/public/LandingPage';
import { PricingPage } from './pages/public/PricingPage';
import { AuthPage } from './pages/public/AuthPage';
import { ContactPage } from './pages/public/ContactPage';
import { DemoPage } from './pages/public/DemoPage';
import { AppLayout } from './pages/app/AppLayout';
import { DashboardPage } from './pages/app/DashboardPage';
import { InboxPage } from './pages/app/InboxPage';
import { CustomersPage } from './pages/app/CustomersPage';
import { CustomerProfilePage } from './pages/app/CustomerProfilePage';
import { ProductsPage } from './pages/app/ProductsPage';
import { OrdersPage } from './pages/app/OrdersPage';
import { OrderCreatePage } from './pages/app/OrderCreatePage';
import { AiStudioPage } from './pages/app/AiStudioPage';
import { AutomationRulesPage } from './pages/app/AutomationRulesPage';
import { TemplatesPage } from './pages/app/TemplatesPage';
import { WorkflowsPage } from './pages/app/WorkflowsPage';
import { TeamPage } from './pages/app/TeamPage';
import { AnalyticsPage } from './pages/app/AnalyticsPage';
import { ConnectionsPage } from './pages/app/ConnectionsPage';
import { WhatsAppSettingsPage } from './pages/app/WhatsAppSettingsPage';
import { SecurityPage } from './pages/app/SecurityPage';
import { LogsPage } from './pages/app/LogsPage';
import { BillingPage } from './pages/app/BillingPage';
import { SettingsPage } from './pages/app/SettingsPage';
import { HelpCenterPage } from './pages/app/HelpCenterPage';
import { CustomerPortalPage } from './pages/app/CustomerPortalPage';
import { SuperAdminPage } from './pages/app/SuperAdminPage';
import { ApiDocsPage } from './pages/app/ApiDocsPage';
import { SandboxPage } from './pages/app/SandboxPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/track/:token" element={<CustomerPortalPage />} />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerProfilePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<OrderCreatePage />} />
        <Route path="ai-studio" element={<AiStudioPage />} />
        <Route path="automation" element={<AutomationRulesPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route path="whatsapp" element={<WhatsAppSettingsPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpCenterPage />} />
        <Route path="admin" element={<SuperAdminPage />} />
        <Route path="api-docs" element={<ApiDocsPage />} />
        <Route path="sandbox" element={<SandboxPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
