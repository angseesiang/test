import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AppPage } from './components/Sidebar';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { NewAssessmentPage } from './pages/NewAssessmentPage';
import { UsersPage } from './pages/UsersPage';
import { AssessmentDetailPage } from './pages/AssessmentDetailPage';
import { Assessment } from './types';

function getInitialRoute() {
  const path = window.location.pathname.replace(/^\//, '') || 'landing';
  return path;
}

function setRoute(path: string) {
  window.history.pushState({}, '', path === 'landing' ? '/' : `/${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AppInner() {
  const { user, loading } = useAuth();
  const [route, setRouteState] = useState(getInitialRoute());
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');

  useEffect(() => {
    const onPop = () => setRouteState(getInitialRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(page: AppPage) {
    if (page === 'assessment-detail') return;
    setRoute(page);
  }

  function openAssessment(id: string) {
    setSelectedAssessmentId(id);
    setRoute('assessment-detail');
  }

  function onAssessmentCreated(assessment: Assessment) {
    setSelectedAssessmentId(assessment.id);
    setRoute('assessment-detail');
  }

  if (loading) {
    return <div className="loadingPage">Loading...</div>;
  }

  if (!user) {
    if (route === 'signin') {
      return <AuthPage mode="signin" setMode={(mode) => { setAuthMode(mode); setRoute(mode); }} onSuccess={() => setRoute('dashboard')} />;
    }

    if (route === 'signup') {
      return <AuthPage mode="signup" setMode={(mode) => { setAuthMode(mode); setRoute(mode); }} onSuccess={() => setRoute('dashboard')} />;
    }

    return (
      <LandingPage
        onSignIn={() => { setAuthMode('signin'); setRoute('signin'); }}
        onGetStarted={() => { setAuthMode('signup'); setRoute('signup'); }}
      />
    );
  }

  const currentPage: AppPage = route === 'assessments'
    ? 'assessments'
    : route === 'new-assessment'
      ? 'new-assessment'
      : route === 'users'
        ? 'users'
        : route === 'assessment-detail'
          ? 'assessment-detail'
          : 'dashboard';

  if (route === 'users' && user.role !== 'admin') {
    return (
      <Layout currentPage="dashboard" navigate={navigate}>
        <DashboardPage navigate={navigate} openAssessment={openAssessment} />
      </Layout>
    );
  }

  return (
    <Layout currentPage={currentPage} navigate={navigate}>
      {currentPage === 'dashboard' && <DashboardPage navigate={navigate} openAssessment={openAssessment} />}
      {currentPage === 'assessments' && <AssessmentsPage navigateNew={() => navigate('new-assessment')} openAssessment={openAssessment} />}
      {currentPage === 'new-assessment' && <NewAssessmentPage onCreated={onAssessmentCreated} />}
      {currentPage === 'users' && user.role === 'admin' && <UsersPage />}
      {currentPage === 'assessment-detail' && <AssessmentDetailPage assessmentId={selectedAssessmentId} goBack={() => navigate('assessments')} />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
