export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'logo compact' : 'logo'}>
      <div className="logoMark">⬢</div>
      {!compact && (
        <div>
          <div className="logoText">NIST AI RMF</div>
          <div className="logoSubtext">ADVISOR</div>
        </div>
      )}
    </div>
  );
}
