export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'blue' | 'neutral' | 'green' | 'orange' | 'red' | 'purple' }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
