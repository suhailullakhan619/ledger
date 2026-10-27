import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'motion/react';
import App from './App';
import './index.css';

// Browsers pause animation frames while a document is hidden. An entrance animation
// started then would stay frozen at its first frame (opacity 0), leaving the page
// blank. While hidden, skip animations so content renders in its final state.
const syncAnimationSkipping = () => {
  MotionGlobalConfig.skipAnimations = document.visibilityState === 'hidden';
};
syncAnimationSkipping();
document.addEventListener('visibilitychange', syncAnimationSkipping);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
