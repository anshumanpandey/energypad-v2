#!/usr/bin/env python3
"""Initialize a fresh instance only; never overwrite an existing environment."""
import os
from pathlib import Path
import secrets
import subprocess

if os.geteuid() != 0:
    raise SystemExit('Run as root on the Lightsail instance.')
config = Path('/etc/energiepad')
names = ('database.env', 'migration.env', 'runtime.env')
if any((config / name).exists() for name in names):
    raise SystemExit('Environment already exists; refusing to replace credentials.')
config.mkdir(mode=0o700, parents=True, exist_ok=True)
os.umask(0o077)
owner = secrets.token_hex(32)
app = secrets.token_hex(32)
(config / 'database.env').write_text(
    f'POSTGRES_USER=energiepad_owner\nPOSTGRES_PASSWORD={owner}\nPOSTGRES_DB=energiepad\n'
)
(config / 'migration.env').write_text(
    f'DATABASE_URL=postgresql://energiepad_owner:{owner}@db:5432/energiepad\n'
)
(config / 'runtime.env').write_text(
    f'DATABASE_URL=postgresql://energiepad_app:{app}@db:5432/energiepad\n'
    f'AUTH_SECRET={secrets.token_urlsafe(48)}\nAUTH_TRUST_HOST=true\n'
    'AUTH_URL=\nRESEND_API_KEY=\nEMAIL_FROM=\nOPEN_METEO_API_KEY=\n'
)
command = ['docker', 'compose', '-f', '/opt/energiepad/compose.yml']
env = {**os.environ, 'APP_IMAGE': 'energiepad-v2:bootstrap'}
subprocess.run([*command, 'up', '-d', '--wait', 'db'], env=env, check=True)
subprocess.run(
    [*command, 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
     '-U', 'energiepad_owner', '-d', 'energiepad'],
    input=f"CREATE ROLE energiepad_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '{app}';\n",
    text=True, env=env, check=True,
)
print('Database initialized. Complete the blank production settings in /etc/energiepad/runtime.env.')
