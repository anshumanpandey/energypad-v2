#!/usr/bin/env bash
# Run as root on Ubuntu 24.04 with this directory and a dedicated public key.
set -euo pipefail
[[ $EUID == 0 && $# == 1 && -f $1 ]] || { echo 'Usage: sudo bash bootstrap.sh deployment-key.pub' >&2; exit 2; }
cd "$(dirname "$0")"
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 755 /opt/energiepad
install -d -m 700 /etc/energiepad /var/backups/energiepad
install -m 644 compose.yml /opt/energiepad/compose.yml
install -m 755 deploy.sh /usr/local/sbin/energiepad-deploy
install -m 755 ssh-command.sh /usr/local/bin/energiepad-ssh-command
# Root-owned key configuration cannot be widened by the deployment account.
install -d -o root -g root -m 755 /home/deploy/.ssh
printf 'restrict,command="/usr/local/bin/energiepad-ssh-command" %s\n' "$(cat "$1")" > /home/deploy/.ssh/authorized_keys
chown root:root /home/deploy/.ssh/authorized_keys
chmod 644 /home/deploy/.ssh/authorized_keys
printf '%s\n' 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/energiepad-deploy' > /etc/sudoers.d/energiepad-deploy
chmod 440 /etc/sudoers.d/energiepad-deploy
visudo -cf /etc/sudoers.d/energiepad-deploy
systemctl enable --now docker
