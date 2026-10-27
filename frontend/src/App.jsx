import { BrowserRouter, Route, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import { LedgerProvider } from './context/LedgerContext';
import Layout from './components/Layout';
import ModalHost from './modals/ModalHost';
import Dashboard from './pages/Dashboard';
import AccountPage from './pages/AccountPage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <LedgerProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts/:id" element={<AccountPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
          <ModalHost />
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            toastOptions={{ style: { borderRadius: '14px', backdropFilter: 'blur(12px)' } }}
          />
        </LedgerProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
