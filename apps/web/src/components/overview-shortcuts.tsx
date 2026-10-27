import Link from 'next/link';

export function OverviewShortcuts({
  base,
  area,
  loginOnly = false,
}: {
  base: string;
  area: 'settings' | 'analytics';
  loginOnly?: boolean;
}) {
  const cards =
    area === 'analytics'
      ? [
          { title: 'Consumption', section: 'consumption' },
          { title: 'Carbon Footprint', section: 'emissions' },
          { title: 'Waste & Savings', section: 'waste-savings' },
        ]
      : [
          { title: 'Business & portfolio', section: 'portfolio' },
          { title: 'Sites', section: 'sites' },
          { title: 'Building energy profile', section: 'consumption' },
          { title: 'Utility & Emissions', section: 'utility-records' },
          { title: 'Energy Tips', section: 'energy-tips' },
          { title: 'Consumption records', section: 'energy' },
          { title: 'HDD & CDD', section: 'degree-days' },
          { title: 'Reports & review', section: 'reports' },
          { title: 'Waste & Savings', section: 'waste-savings' },
        ];
  return (
    <>
      <h1 className="overview-page-title sr-only">Overview</h1>
      <nav
        id="overview-settings"
        className="overview-settings-grid"
        aria-label={area === 'analytics' ? 'Analytics shortcuts' : 'Settings shortcuts'}
      >
        {cards.map(({ title, section }) => (
          <article className="overview-settings-card" key={section}>
            <h2>{title}</h2>
            <Link href={loginOnly ? '/login' : `${base}/${section}`} aria-label={`View ${title}`}>
              View
            </Link>
          </article>
        ))}
      </nav>
      <section className="overview-files" aria-labelledby="overview-files-title">
        <h2 id="overview-files-title">Files</h2>
        <div className="overview-files-scroll" role="region" aria-label="Data files" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Data set</th>
                <th>Template</th>
                <th>Records</th>
                <th>Upload file</th>
              </tr>
            </thead>
            <tbody>
              {[
                { title: 'Sites', template: 'sites.xlsx', section: 'sites' },
                { title: 'Consumption', template: 'consumption-latest.xlsx', section: 'energy' },
                { title: 'Utility & Emissions', template: 'historic-data.xlsx', section: 'utility-records' },
              ].map(({ title, template, section }) => (
                <tr key={title}>
                  <th scope="row">{title}</th>
                  <td>
                    <a
                      href={loginOnly ? '/login' : `/templates/${template}`}
                      download={!loginOnly}
                      aria-label={`Download ${title} template`}
                    >
                      Download template
                    </a>
                  </td>
                  <td>
                    <Link href={loginOnly ? '/login' : `${base}/${section}`} aria-label={`View ${title} records`}>
                      View
                    </Link>
                  </td>
                  <td>
                    <Link
                      className="overview-upload-link"
                      href={loginOnly ? '/login' : `${base}/${title === 'Sites' ? 'sites' : 'energy'}`}
                      aria-label={`Upload ${title} file`}
                    >
                      Upload
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
