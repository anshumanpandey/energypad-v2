'use client';
import { useState, type ReactNode } from 'react';
import { HistoricImport } from './data-import-workspace';
import { HistoricEmissionsImport } from './historic-emissions-import';
import { TargetImport } from './target-import';
import { DriverClassificationImport } from './driver-classification-import';
import { AllConsumption } from './all-consumption';
import { EnergyWorkspace } from './energy-workspace';
import { MonthlyPlans } from './monthly-plans';

const tabs = ['Consumption', 'Emissions', 'Drivers', 'Targets'] as const;
export function UploadDataTabs({
  orgId,
  sites,
  manage,
  emissions,
}: {
  orgId: string;
  sites: { id: string; name: string }[];
  manage: boolean;
  emissions: ReactNode;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Consumption');
  return (
    <section className="stack-form" aria-label="Uploaded data">
      <h2>Uploaded data</h2>
      <div className="data-import-tabs" role="tablist" aria-label="Uploaded data sheets">
        {tabs.map((name, index) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`uploaded-tab-${name}`}
            aria-controls={`uploaded-panel-${name}`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? tabs[0]
                  : event.key === 'End'
                    ? tabs[3]
                    : tabs[(index + (event.key === 'ArrowRight' ? 1 : 3)) % 4];
              setTab(next);
              document.getElementById(`uploaded-tab-${next}`)?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`uploaded-panel-${tab}`} aria-labelledby={`uploaded-tab-${tab}`}>
        {tab === 'Consumption' && (
          <>
            {manage && <HistoricImport orgId={orgId} workbookLabel="Latest consumption workbook" />}
            <AllConsumption orgId={orgId} sites={sites} />
            <EnergyWorkspace orgId={orgId} sites={sites} manage={manage} />
          </>
        )}
        {tab === 'Emissions' && (
          <>
            {manage && <HistoricEmissionsImport orgId={orgId} />}
            {emissions}
          </>
        )}
        {tab === 'Drivers' &&
          (manage ? (
            <DriverClassificationImport orgId={orgId} />
          ) : (
            <p>Ask an owner or admin to manage driver classifications.</p>
          ))}
        {tab === 'Targets' && (
          <>
            {manage && <TargetImport orgId={orgId} />}
            <MonthlyPlans organisationId={orgId} sites={sites} canWrite={manage} />
          </>
        )}
      </div>
    </section>
  );
}
