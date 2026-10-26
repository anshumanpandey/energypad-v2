import Image from 'next/image';
import Link from 'next/link';

export function OverviewShortcuts({ base, manageMembers }: { base: string; manageMembers: boolean }) {
  const cards = [
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
      <section className="overview-hub-hero" aria-labelledby="overview-title">
        <h1 id="overview-title">Overview</h1>
        <nav className="overview-hub-options" aria-label="Workspace areas">
          <a className="overview-hub-option is-current" href="#overview-settings">
            <Image src="/assets/welcome/settings.svg" alt="" width={100} height={100} />
            <span>Settings</span>
          </a>
          <Link className="overview-hub-option" href={`${base}/consumption`}>
            <Image src="/assets/welcome/dashboard.svg" alt="" width={100} height={100} />
            <span>Analytics</span>
          </Link>
          {manageMembers ? (
            <Link className="overview-hub-option" href={`${base}/members`}>
              <Image src="/assets/welcome/key.svg" alt="" width={100} height={100} />
              <span>User Management</span>
            </Link>
          ) : (
            <div className="overview-hub-option is-unavailable">
              <Image src="/assets/welcome/key.svg" alt="" width={100} height={100} />
              <span>User Management</span>
              <small>Managed by your workspace administrator</small>
            </div>
          )}
        </nav>
      </section>
      <nav id="overview-settings" className="overview-settings-grid" aria-label="Settings shortcuts">
        {cards.map(({ title, section }) => (
          <article className="overview-settings-card" key={section}>
            <h2>{title}</h2>
            <Link href={`${base}/${section}`} aria-label={`View ${title}`}>
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
                    <a href={`/templates/${template}`} download aria-label={`Download ${title} template`}>
                      Download template
                    </a>
                  </td>
                  <td>
                    <Link href={`${base}/${section}`} aria-label={`View ${title} records`}>
                      View
                    </Link>
                  </td>
                  <td>
                    <Link
                      className="overview-upload-link"
                      href={`${base}/${title === 'Sites' ? 'sites' : 'energy'}`}
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
