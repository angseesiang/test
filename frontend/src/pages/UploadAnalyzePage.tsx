import { useState } from 'react';
import { ResultsTable } from '../components/ResultsTable';

export function UploadAnalyzePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  async function run() {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    setRows(data.rows ?? []);
  }
  return <div><h2>Analyze</h2><textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} /><button onClick={run}>Run</button><ResultsTable rows={rows} /></div>;
}
