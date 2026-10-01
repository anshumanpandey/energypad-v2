export function WasteDirection({ direction }: { direction: string }) {
  const tone = direction === 'SAVING' ? 'saving' : direction === 'WASTE' ? 'waste' : 'neutral';
  return <span className={`waste-direction waste-direction-${tone}`}>{direction.replaceAll('_', ' ')}</span>;
}
