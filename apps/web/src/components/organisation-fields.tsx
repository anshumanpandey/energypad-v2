export function OrganisationFields({ values }: { values?: { name: string; currency: string; timezone: string } }) {
  return (
    <>
      <label>
        Organisation name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={values?.name}
          placeholder="e.g. Northstar Properties"
          autoComplete="organization"
        />
      </label>
      <div className="form-grid">
        <label>
          Reporting currency
          <select name="currency" defaultValue={values?.currency ?? 'GBP'}>
            {['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'INR'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Time zone
          <input
            name="timezone"
            list="timezones"
            required
            defaultValue={values?.timezone ?? 'Europe/London'}
            maxLength={100}
          />
          <datalist id="timezones">
            {[
              'Europe/London',
              'Europe/Paris',
              'America/New_York',
              'America/Bogota',
              'Asia/Kolkata',
              'Australia/Sydney',
              'UTC',
            ].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
      </div>
      <p className="field-hint">Used for reporting and dates across your workspace. You can update these later.</p>
    </>
  );
}
