import { useState } from 'react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit() {
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  }
  return <div><h2>Login</h2><input value={email} onChange={(e)=>setEmail(e.target.value)} /><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /><button onClick={submit}>Login</button></div>;
}
