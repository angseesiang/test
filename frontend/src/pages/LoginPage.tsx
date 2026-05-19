import { useState } from 'react';

export function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password');
  const [message, setMessage] = useState('');

  async function submit() {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`Login failed: ${data.message ?? 'Unknown error'}`);
        return;
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      setMessage('Login successful');
    } catch (error) {
      setMessage('Login error. Check whether backend is running on port 4000.');
    }
  }

  return (
    <div>
      <h2>Login</h2>

      <div style={{ marginBottom: 8 }}>
        <label>Email</label>
        <br />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: 320, padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>Password</label>
        <br />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: 320, padding: 8 }}
        />
      </div>

      <button onClick={submit}>Login</button>

      {message && <p>{message}</p>}
    </div>
  );
}