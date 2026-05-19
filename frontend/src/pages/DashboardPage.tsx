import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { getAssessments } from '../lib/api';
import { Assessment } from '../types';
import { useAuth } from '../context/AuthContext';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

function RadarChart({ scores }: { scores: { govern: number; map: number; measure: number; manage: number } }) {
  const center = 120;
  const max = 90;
  const points = [
    [center, center - (scores.govern / 100) * max],
    [center + (scores.map / 100) * max, center],
    [center, center + (scores.measure / 100) * max],
    [center - (scores.manage / 100) * max, center]
  ];

  const polygon = points.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width="300" height="260" viewBox="0 0 240 240" className="radarSvg">
      {[20, 40, 60, 80, 100].map((level) => {
        const r = (level / 100) * max;
        return <polygon key={level} points={`${center},${center - r} ${center + r},${center} ${center},${center + r} ${center - r},${center}`} fill="none" stroke="#dbe5f0" />;
      })}
      <line x1={center} y1={center - max} x2={center} y2={center + max} stroke="#e1e8f0" />
      <line x1={center - max} y1={center} x2={center + max} y2={center} stroke="#e1e8f0" />
      <polygon points={polygon} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2" />
      <text x={center} y="18" textAnchor="middle">Govern</text>
      <text x="223" y={center + 5} textAnchor="middle">Map</text>
      <text x={center} y="232" textAnchor="middle">Measure</text>
      <text x="17" y={center + 5} textAnchor="middle">Manage</text>
    </svg>
  );
}

export function DashboardPage({ navigate, openAssessment }: { navigate: (page: 'new-assessment' | 'assessments') => void; openAssessment: (id: string) => void }) {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    getAssessments().then((data) => setAssessments(data.assessments)).catch(() => setAssessments([]));
  }, []);

  const stats = useMemo(() => {
    const total = assessments.length;
    const averageScore = total ? Math.round(assessments.reduce((sum, assessment) => sum + assessment.summary.averageScore, 0) / total) : 0;
    const recent = assessments.slice(0, 4);
    const scores = total
      ? {
          govern: Math.round(assessments.reduce((sum, assessment) => sum + assessment.summary.governScore, 0) / total),
          map: Math.round(assessments.reduce((sum, assessment) => sum + assessment.summary.mapScore, 0) / total),
          measure: Math.round(assessments.reduce((sum, assessment) => sum + assessment.summary.measureScore, 0) / total),
          manage: Math.round(assessments.reduce((sum, assessment) => sum + assessment.summary.manageScore, 0) / total)
        }
      : { govern: 0, map: 0, measure: 0, manage: 0 };

    return { total, averageScore, recent, scores };
  }, [assessments]);

  return (
    <div>
      <div className="pageHeader rowHeader">
        <div>
          <h1>Welcome back, {user?.name ?? 'User'}</h1>
          <p>Track your AI risk management maturity against the NIST AI RMF.</p>
        </div>
        <Button className="primary" onClick={() => navigate('new-assessment')}>＋ New Assessment</Button>
      </div>

      <div className="statGrid">
        <div className="statCard">
          <span>▤ Total Assessments</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="statCard">
          <span>⌁ Average Score</span>
          <strong>{stats.total ? `${stats.averageScore}/100` : '—/100'}</strong>
        </div>
        <div className="statCard">
          <span>⌁ Trend</span>
          <strong>— 0 pts <small>vs previous</small></strong>
        </div>
      </div>

      <div className="dashboardGrid">
        <section className="panel">
          <div className="panelHeader">
            <h2>RMF Function Scores</h2>
            <p>Average maturity score per function</p>
          </div>
          <div className="radarWrap">
            <RadarChart scores={stats.scores} />
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader split">
            <div>
              <h2>Recent Assessments</h2>
              <p>Your latest evaluations</p>
            </div>
            <button className="linkButton" onClick={() => navigate('assessments')}>View all →</button>
          </div>
          <div className="recentList">
            {stats.recent.length === 0 && <p className="emptyState">No assessments yet.</p>}
            {stats.recent.map((assessment) => (
              <button key={assessment.id} className="recentItem" onClick={() => openAssessment(assessment.id)}>
                <div>
                  <strong>{assessment.title}</strong>
                  <span>Assessment {formatDate(assessment.date)}</span>
                </div>
                <Badge label={assessment.summary.maturity} tone={assessment.summary.maturity === 'Initial' ? 'neutral' : 'blue'} />
                <span>›</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
