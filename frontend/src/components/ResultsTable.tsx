export function ResultsTable({ rows }: { rows: any[] }) {
  return <table><thead><tr>
    <th>Match ID</th><th>User source type</th><th>User file name</th><th>User location</th><th>User wording</th><th>Vector store ID</th><th>Vector store source file</th><th>Matched vector store wording</th><th>Similarity score</th><th>NIST AI RMF function</th><th>Governance interpretation</th><th>Risk/gap</th><th>Recommended action</th>
  </tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{i+1}</td><td>{r.sourceType ?? 'prompt'}</td><td>{r.userFileName ?? '-'}</td><td>{JSON.stringify(r.location ?? {})}</td><td>{r.chunk}</td><td>{r.vectorStoreId ?? '-'}</td><td>{r.vectorStoreSourceFile ?? '-'}</td><td>{r.matchedText ?? r.message}</td><td>{r.score ?? '-'}</td><td>{r.rmfFunction ?? '-'}</td><td>{r.interpretation ?? '-'}</td><td>{r.riskGap ?? '-'}</td><td>{r.recommendedAction ?? '-'}</td></tr>)}</tbody></table>;
}
