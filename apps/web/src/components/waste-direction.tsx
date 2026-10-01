export function WasteDirection({ direction }: { direction: string }) {
  const tone = direction === 'SAVING' ? 'saving' : direction === 'WASTE' ? 'waste' : 'neutral';
  return <span className={`waste-direction waste-direction-${tone}`}>{direction.replaceAll('_', ' ')}</span>;
}

export function WasteDirectionText({ text }: { text: string }) {
  return text
    .split(/\b(SAVING|WASTE)\b/g)
    .map((part, index) =>
      part === 'SAVING' || part === 'WASTE' ? <WasteDirection key={index} direction={part} /> : part,
    );
}
