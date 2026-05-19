import { Logo } from '../components/Logo';

export function LandingPage({ onSignIn, onGetStarted }: { onSignIn: () => void; onGetStarted: () => void }) {
  return (
    <div className="landingPage gridBackground">
      <div className="landingHero">
        <Logo compact />
        <h1>NIST AI RMF Advisor</h1>
        <p>
          Evaluate your AI system's risk management maturity against all four<br />
          NIST AI RMF functions — Govern, Map, Measure, and Manage.
        </p>
        <div className="landingActions">
          <button className="primaryButton" onClick={onSignIn}>Sign In</button>
          <button className="secondaryButton" onClick={onGetStarted}>Get Started</button>
        </div>
      </div>
    </div>
  );
}
