type LockupProps = {
  className?: string;
  context?: "brand" | "docs";
};

export function SurrealityMark({ className = "" }: { className?: string }) {
  return <img className={`brand-mark ${className}`.trim()} src="/surreality-mark.png" alt="" />;
}

export function SurrealityLockup({ className = "", context = "brand" }: LockupProps) {
  return (
    <span className={`brand-lockup brand-lockup-${context} ${className}`.trim()}>
      <span className="brand-core">
        <SurrealityMark />
        <span className="brand-name">SURREALITY</span>
      </span>
      {context === "docs" ? <><b aria-hidden="true">/</b><em>Developer docs</em></> : null}
    </span>
  );
}
