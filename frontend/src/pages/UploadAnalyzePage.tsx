import { useState } from 'react';
import { ResultsTable } from '../components/ResultsTable';

type FlatResultRow = {
  chunk?: string;
  vectorStoreId?: string;
  sourceFile?: string;
  matchedText?: string;
  score?: number;
  message?: string;
};

export function UploadAnalyzePage() {
  const [prompt, setPrompt] = useState('');
  const [rows, setRows] = useState<FlatResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setLoading(true);
    setMessage('');
    setRows([]);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`Analyze failed: ${data.message ?? 'Unknown error'}`);
        return;
      }

      const flattenedRows: FlatResultRow[] = [];

      for (const item of data.rows ?? []) {
        const chunk = item.chunk;

        for (const match of item.matches ?? []) {
          flattenedRows.push({
            chunk,
            vectorStoreId: match.vectorStoreId,
            sourceFile: match.sourceFile,
            matchedText: match.matchedText,
            score: match.score,
            message: match.message
          });
        }
      }

      setRows(flattenedRows);
      setMessage(`Analysis complete. ${flattenedRows.length} result rows returned.`);
    } catch (error) {
      setMessage('Analyze error. Check whether backend is running on port 4000.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Analyze</h2>

      <p>
        Enter text to match against the configured OpenAI vector stores.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        style={{ width: '100%', maxWidth: 900, padding: 8 }}
        placeholder="Example: Assess whether this AI system has governance controls, audit logging, access control, risk assessment, and human review."
      />

      <br />

      <button onClick={run} disabled={loading || !prompt.trim()} style={{ marginTop: 12 }}>
        {loading ? 'Running...' : 'Run Analysis'}
      </button>

      {message && <p>{message}</p>}

      <ResultsTable rows={rows} />
    </div>
  );
}