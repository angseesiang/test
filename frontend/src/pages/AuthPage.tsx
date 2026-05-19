import { useState } from 'react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

export function AuthPage({ mode, setMode, onSuccess }: { mode: 'signin' | 'signup'; setMode: (mode: 'signin' | 'signup') => void; onSuccess: () => void }) {
  const { signIn, signUp } = useAuth();
  const [name, setName] = useState('Jane Doe');
  const [email, setEmail] = useState(mode === 'signin' ? 'admin@example.com' : 'you@example.com');
  const [password, setPassword] = useState('password');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authHeader">
        <Logo compact />
        <h1>NIST AI RMF Advisor</h1>
        <p>AI Risk Management Framework Assessment Platform</p>
      </div>

      <div className="authCard">
        <h2>{mode === 'signup' ? 'Create your account' : 'Sign in to your account'}</h2>
        <p>{mode === 'signup' ? 'Sign up to start evaluating your AI governance posture.' : 'Sign in to continue your assessments.'}</p>

        {mode === 'signup' && (
          <label className="fieldLabel">
            Full name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" />
          </label>
        )}

        <label className="fieldLabel">
          Email address
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>

        <label className="fieldLabel">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
        </label>

        {message && <div className="errorBox">{message}</div>}

        <button className="primaryButton fullWidth" onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </div>

      <p className="authSwitch">
        {mode === 'signup' ? 'Already have an account?' : 'Need an account?'}{' '}
        <button onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Sign in' : 'Create account'}
        </button>
      </p>
    </div>
  );
}
