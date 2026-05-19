import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

export function AuthPage({
  mode,
  setMode,
  onSuccess
}: {
  mode: 'signin' | 'signup';
  setMode: (mode: 'signin' | 'signup') => void;
  onSuccess: () => void;
}) {
  const { signIn, signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName('');
    setEmail('');
    setPassword('');
    setMessage('');
  }, [mode]);

  const canSubmit =
    mode === 'signup'
      ? name.trim().length > 0 && email.trim().length > 0 && password.length > 0
      : email.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!canSubmit || loading) return;

    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
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
        <p>
          {mode === 'signup'
            ? 'Sign up to start evaluating your AI governance posture.'
            : 'Sign in to continue your assessments.'}
        </p>

        {mode === 'signup' && (
          <label className="fieldLabel">
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
          </label>
        )}

        <label className="fieldLabel">
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>

        <label className="fieldLabel">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="new-password"
          />
        </label>

        {message && <div className="errorBox">{message}</div>}

        <button className="primaryButton fullWidth" onClick={submit} disabled={loading || !canSubmit}>
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