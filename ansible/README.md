# Ansible deployment for ArenaReserve

This folder contains a ready configuration-management setup using Ansible.

## What is included

- Inventories for development and production hosts.
- A deploy playbook: infrastructure + application deployment.
- Docker installation role for Debian-based hosts.
- Git-based application delivery role.

## Quick start

1. Install Ansible on your control machine.
2. Update repository URL in `group_vars/all.yml`.
3. Set real host/user values in `inventories/prod/hosts.yml`.
4. Run:

   ansible-playbook -i inventories/dev/hosts.yml playbooks/deploy.yml

## Windows note (recommended in this repository)

If local `ansible-playbook.exe` is blocked by Windows policy, use Docker runtime:

docker run --rm -v "${PWD}:/work" -w /work/ansible -e ANSIBLE_CONFIG=/work/ansible/ansible.cfg cytopia/ansible:latest ansible-playbook -i inventories/dev/hosts.yml playbooks/deploy.yml --syntax-check

Or use project helper script:

powershell -ExecutionPolicy Bypass -File .\ansible-docker.ps1 syntax

## Production run

ansible-playbook -i inventories/prod/hosts.yml playbooks/deploy.yml

## Useful checks

ansible -i inventories/prod/hosts.yml all -m ping

## Notes

- For production, replace placeholder secrets in `.env`.
- The playbook uses `docker compose` and project compose files.
