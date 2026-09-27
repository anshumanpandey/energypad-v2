type HealthStatus = 'ok' | 'unavailable';
type HealthEvent = { event: 'database_health_changed'; status: HealthStatus };

// A timed-out probe remains shared until it settles. Repeated health requests
// must not fill the application's database pool with abandoned queries.
export class DatabaseHealth {
  private active: Promise<HealthStatus> | undefined;
  private previous: HealthStatus | undefined;

  constructor(
    private readonly probe: () => Promise<unknown>,
    private readonly report: (event: HealthEvent) => void,
    private readonly timeoutMs = 2000,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid health timeout');
  }

  check(): Promise<HealthStatus> {
    if (this.active) return this.active;
    let finish!: (status: HealthStatus) => void;
    const result = new Promise<HealthStatus>((resolve) => {
      finish = resolve;
    });
    const timer = setTimeout(() => finish('unavailable'), this.timeoutMs);
    this.active = result.then((status) => {
      if (status !== this.previous) {
        this.previous = status;
        try {
          this.report({ event: 'database_health_changed', status });
        } catch {
          // Logging failure cannot change availability or expose driver errors.
        }
      }
      return status;
    });
    void Promise.resolve()
      .then(this.probe)
      .then(
        () => finish('ok'),
        () => finish('unavailable'),
      )
      .finally(() => {
        clearTimeout(timer);
        this.active = undefined;
      });
    return this.active;
  }
}
