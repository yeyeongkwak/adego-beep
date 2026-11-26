#!/usr/bin/env bash
# Run once on a fresh Ubuntu VM: sudo bash setup-vm.sh
set -euo pipefail

# Docker (official install script)
curl -fsSL https://get.docker.com | sh
usermod -aG docker "${SUDO_USER:-$USER}"

# 2GB swap: a safety net so a memory spike slows OTP down instead of killing it.
if ! swapon --show | grep -q /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The otp-graph workflow copies files here and runs docker compose.
mkdir -p /opt/otp
chown "${SUDO_USER:-$USER}" /opt/otp

echo 'Done. Log out and back in so the docker group applies.'
