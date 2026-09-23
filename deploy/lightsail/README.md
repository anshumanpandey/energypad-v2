# Lightsail automatic deployment

Target: `energiepad-v2`, London (`eu-west-2`), Ubuntu 24.04, 4 GB RAM.
The V2 application is `apps/web`; the repository-root Docker files belong to the legacy application.

## Pipeline

`.github/workflows/v2-ci.yml` runs the existing audit, formatting, lint, types,
unit, database integration, build and browser checks. Only a successful `main`
push (or manual run on `main`) proceeds to the `production` environment. PRs
never receive deployment credentials. Deployments are serialized and are not
cancelled halfway through migrations. The image is built on GitHub, not on the
4 GB server. No production secrets are included in the image or build context.

Production environment secrets:

- `LIGHTSAIL_HOST`: stable public IP of this instance.
- `LIGHTSAIL_SSH_KEY`: dedicated deployment private key, **not** the AWS default key.
- `LIGHTSAIL_KNOWN_HOSTS`: SSH host-key record verified through AWS's terminal.

Protect `main` against unreviewed changes. Anyone able to modify code that reaches
this deployment can run application code and access application data. The SSH
key only accepts `deploy <40-character SHA>`; no interactive shell, forwarding,
or caller-supplied Docker arguments. The account is not in the Docker group.

## Server setup

Install Ubuntu's `docker.io`, `docker-compose-v2`, and `nginx` packages. Copy this
directory and the deployment public key to the server, then run
`sudo bash bootstrap.sh /absolute/path/to/deployment-key.pub`.
The admin owns installed scripts and Compose configuration. Changes to these
files require an admin to reinstall them; application deployments cannot alter
the host configuration.

Attach a Lightsail static IPv4 before relying on DNS or CI across stop/start.
For a fresh server, run `sudo python3 initialize.py`: it generates separate
owner/runtime passwords and an auth secret, creates the database and runtime
role, and leaves production service settings blank. It refuses to overwrite
existing credentials. Complete these root-only files under `/etc/energiepad`
(mode `600`):

`database.env`:

```dotenv
POSTGRES_USER=energiepad_owner
POSTGRES_PASSWORD=<random database owner password>
POSTGRES_DB=energiepad
```

`migration.env`:

```dotenv
DATABASE_URL=postgresql://energiepad_owner:<URL-safe owner password>@db:5432/energiepad
```

`runtime.env`:

```dotenv
DATABASE_URL=postgresql://energiepad_app:<different URL-safe password>@db:5432/energiepad
AUTH_URL=https://<app domain>
AUTH_SECRET=<random secret>
AUTH_TRUST_HOST=true
RESEND_API_KEY=<Resend production key>
EMAIL_FROM=EnergiePad <verified sender address>
OPEN_METEO_API_KEY=<key with historical weather access>
```

For manual initialization instead of `initialize.py`, start the database with `APP_IMAGE=energiepad-v2:bootstrap docker compose -f
/opt/energiepad/compose.yml up -d db`. Using the owner connection, create the
`energiepad_app` login with the runtime password and `NOSUPERUSER NOCREATEDB
NOCREATEROLE`. The deployment grants only schema usage, table DML and sequence
usage after migrations. The runtime role does not own tables or triggers.

Configure nginx for the supplied domain and a valid TLS certificate, proxying
to `127.0.0.1:3100`. Forward `Host`, `X-Forwarded-Proto`, and
`X-Forwarded-For`, disable proxy buffering, and avoid logging query strings or
invitation paths containing tokens. Redirect HTTP to HTTPS. PostgreSQL has no
published port; the app listens only on host loopback through Docker.

## Verification and recovery

A deployment refuses incomplete production configuration, loads the streamed
image, waits for Postgres, creates a `pg_dump` in `/var/backups/energiepad`, runs
migrations and the idempotent plan seed, then waits for `/api/health` (including
a database query) and starts the weather worker. Failed startup restores the
previous application image when available. **Schema changes are not reversed**:
use backward-compatible migrations; destructive changes require a separate
reviewed maintenance/restore plan. A failed migration leaves current services
running and must be investigated before retrying.

Inspect with `sudo docker compose --env-file /opt/energiepad/release.env -f
/opt/energiepad/compose.yml ps`. Keep backups off-instance and define retention
before customer data is stored. Monitor disk usage: backups and previous images
are retained intentionally, without automatic destructive pruning.

The first deployment still requires GitHub authentication, the three environment
secrets, a production domain/mail configuration, a successful CI run, and an
HTTPS sign-in smoke test. Deployment does not change Sprint 4's UNVALIDATED
scientific-output status.

## Current installation status

The instance at `16.60.161.140` has Docker/Compose/nginx installed, the restricted
`deploy` account and scripts installed, and a healthy Postgres database with the
separate runtime role. Its current IPv4 is dynamic. Environment files are
root-only; domain, Resend and sender settings are blank. The existing weather
credential has been configured. The dedicated
key is stored locally in the gitignored `apps/web/.local/deployment/` directory.
No key or production credential belongs in this repository.

GitHub's `production` environment is created and allows only the `main`
branch. The repository is still empty. Publishing access and the deployment
private-key secret are awaiting approval; no workflow has run and public app/TLS
have not been activated. Complete the connection and production settings before
considering automatic deployment operational.

Validation passed: production Docker image build, loopback container health check
with PostgreSQL (`status: ok`), TypeScript, health-route lint, formatting, YAML
parsing, shell syntax, SSH command restriction and missing-config preflight.
