import { Zap } from 'lucide-react';
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Zap size={21} fill="currentColor" />
      </span>
      energie<span className="brand-light">pad</span>
      <span className="brand-version">V2</span>
    </span>
  );
}
