import { AssessmentResultRow } from '../types';
import { Badge } from './Badge';

function statusTone(status: AssessmentResultRow['matchStatus']) {
  if (status === 'MATCHING') return 'green' as const;
  if (status === 'POSSIBLE_MATCH_NOT_IDENTICAL') return 'orange' as const;
  if (status === 'NOT_EXTRACTABLE') return 'purple' as const;
  return 'red' as const;
}

export function ResultsTable({ rows }: { rows: AssessmentResultRow[] }) {
  if (!rows.length) {
    return <p className="muted">No results yet.</p>;
  }

  return (
    <div className="tableScroll">
      <table className="dataTable wideTable">
        <thead>
          <tr>
            <th>Match ID</th>
            <th>Status</th>
            <th>Exact</th>
            <th>User Source</th>
            <th>User File</th>
            <th>User Location</th>
            <th>User Wording / Point</th>
            <th>Vector Store ID</th>
            <th>Vector Store Source</th>
            <th>Matched Vector Store Wording</th>
            <th>Similarity</th>
            <th>RMF Function</th>
            <th>Governance Interpretation</th>
            <th>Risk / Gap</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.matchId}>
              <td>{row.matchId}</td>
              <td><Badge label={row.matchStatus} tone={statusTone(row.matchStatus)} /></td>
              <td>{row.isExactMatch ? 'Yes' : 'No'}</td>
              <td>{row.userSourceType}</td>
              <td>{row.userFileName}</td>
              <td>{JSON.stringify(row.userLocation)}</td>
              <td className="longCell">{row.userWording || '-'}</td>
              <td>{row.vectorStoreId}</td>
              <td>{row.vectorStoreSourceFile}</td>
              <td className="longCell">{row.matchedVectorStoreWording}</td>
              <td>{row.similarityScore}</td>
              <td>{row.nistAiRmfFunction}</td>
              <td className="longCell">{row.governanceInterpretation}</td>
              <td className="longCell">{row.riskGap}</td>
              <td className="longCell">{row.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
