'use client';
import { useState } from 'react';
import Image from 'next/image';
import { energyTips } from '@/domain/energy-tips';
import { csvCell } from '@/domain/carbon-report';
import { Button } from './ui/button';

const categories = [
  ['', 'All categories'],
  ['Heating', 'Heating'],
  ['Cooling', 'Cooling'],
  ['Power', 'Lighting & Power'],
] as const;
export function EnergyTips() {
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const tips = energyTips
    .filter((tip) => !category || tip.category === category)
    .sort((a, b) => Number(b.category === priority) - Number(a.category === priority) || a.id - b.id);
  const download = () => {
    const csv = [
      ['Category', 'Energy saving tip', 'Illustration'],
      ...energyTips.map((tip) => [
        tip.category === 'Power' ? 'Lighting & Power' : tip.category,
        tip.text,
        tip.imageUrl,
      ]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'energiepad-energy-tips.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ENERGY SAVING TIPS</span>
          <h1>Energy Tips</h1>
          <p>Practical heating, cooling, lighting and power tips from the original EnergiePad catalogue.</p>
        </div>
      </div>
      <section className="panel stack-form" aria-label="Energy Tips filters">
        <div className="form-grid">
          {[
            { label: 'Filter by category', selected: category, update: setCategory },
            { label: 'Sort by category', selected: priority, update: setPriority },
          ].map(({ label, selected, update }) => (
            <label key={label}>
              {label}
              <select value={selected} onChange={(event) => update(event.target.value)}>
                {categories.map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="utility-graph-actions">
          <Button onClick={download}>Download Entire Document</Button>
          <Button onClick={() => window.print()}>Print tips</Button>
        </div>
        <p role="status">
          {tips.length} tips · Applicable across sites; choose tips suitable for your equipment and operating needs.
        </p>
      </section>
      <div className="energy-tips-grid">
        {tips.map((tip) => (
          <article className="panel energy-tip-card" key={tip.id}>
            {tip.imageUrl && <Image src={tip.imageUrl} alt="" width={600} height={420} />}
            <span className="eyebrow">{tip.category === 'Power' ? 'Lighting & Power' : tip.category}</span>
            <p>{tip.text}</p>
          </article>
        ))}
      </div>
    </>
  );
}
