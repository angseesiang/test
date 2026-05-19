import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { getAssessments } from '../lib/api';
import { Assessment } from '../types';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export function AssessmentsPage({ navigateNew, openAssessment }: { navigateNew: () => void; openAssessment: (id: string) => void }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const data = await getAssessments();
      setAssessments(data.assessments);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load assessments.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div>
          <h1>Assessments</h1>
          <p>All AI risk management evaluations.</p>
        </div>
        <Button className="primary" onClick={navigateNew}>＋ New Assessment</Button>
      </div>

      {message && <div className="errorBox">{message}</div>}

      <div className="tableCard">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Summary</th>
              <th>Maturity</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 && (
              <tr><td colSpan={5} className="emptyCell">No assessments yet.</td></tr>
            )}
            {assessments.map((assessment) => (
              <tr key={assessment.id} onClick={() => openAssessment(assessment.id)} className="clickableRow">
                <td>{formatDate(assessment.date)}</td>
                <td className="summaryCell">{assessment.title}</td>
                <td><Badge label={assessment.summary.maturity} tone={assessment.summary.maturity === 'Initial' ? 'neutral' : 'blue'} /></td>
                <td>{assessment.summary.averageScore ? `${assessment.summary.averageScore}/100` : '—'}</td>
                <td>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
