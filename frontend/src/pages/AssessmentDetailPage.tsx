import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ResultsTable } from '../components/ResultsTable';
import { getAssessment } from '../lib/api';
import { Assessment } from '../types';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export function AssessmentDetailPage({ assessmentId, goBack }: { assessmentId: string; goBack: () => void }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getAssessment(assessmentId)
      .then((data) => setAssessment(data.assessment))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load assessment.'));
  }, [assessmentId]);

  if (message) {
    return <div><Button onClick={goBack}>← Back</Button><div className="errorBox">{message}</div></div>;
  }

  if (!assessment) {
    return <div><Button onClick={goBack}>← Back</Button><p className="muted">Loading assessment...</p></div>;
  }

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div>
          <button className="linkButton" onClick={goBack}>← Back to assessments</button>
          <h1>{assessment.title}</h1>
          <p>Assessment {formatDate(assessment.date)}</p>
        </div>
      </div>

      <div className="statGrid detailStats">
        <div className="statCard"><span>Average Score</span><strong>{assessment.summary.averageScore}/100</strong></div>
        <div className="statCard"><span>Maturity</span><strong>{assessment.summary.maturity}</strong></div>
        <div className="statCard"><span>Matching</span><strong>{assessment.summary.matchingCount}</strong></div>
        <div className="statCard"><span>Not Matched</span><strong>{assessment.summary.notMatchedCount}</strong></div>
      </div>

      <section className="panel detailPanel">
        <div className="panelHeader">
          <h2>System Description</h2>
        </div>
        <p>{assessment.systemDescription || 'No text description provided.'}</p>
        {assessment.uploadedFileNames.length > 0 && (
          <p><strong>Uploaded files:</strong> {assessment.uploadedFileNames.join(', ')}</p>
        )}
      </section>

      <section className="panel detailPanel">
        <div className="panelHeader">
          <h2>Evidence Matching Results</h2>
          <p>Matching, partial matching, and recommendation results for extracted user points.</p>
        </div>
        <ResultsTable rows={assessment.rows} />
      </section>
    </div>
  );
}
