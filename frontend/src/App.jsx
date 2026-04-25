import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import MerchantDashboard from './pages/MerchantDashboard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import { Spinner } from './components/UI';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Spinner size="lg" />
    </div>
  );

  if (!user) return <AuthPage />;
  if (user.role === 'reviewer') return <ReviewerDashboard />;
  return <MerchantDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
