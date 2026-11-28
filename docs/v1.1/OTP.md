# OTP server

OpenTripPlanner finds the journeys. It runs on one small VM; the app falls
back to Google Routes when it's down.

```
GitHub Actions (otp-graph.yml)
  build graph: GTFS zip + streetGraph.obj (release asset)
  scp graph.obj + config ──▶ Oracle VM /opt/otp
                              ├── otp    (opentripplanner:2.9.0, 1 GB heap)
                              └── caddy  (HTTPS; only /otp/gtfs/v1 is public)
                                     ▲
Vercel /api/directions ── POST /otp/gtfs/v1 (GraphQL)
```

## The VM

| What     | Value                                                    |
| -------- | -------------------------------------------------------- |
| Provider | Oracle Cloud, Pay As You Go, kept inside Always Free     |
| Shape    | VM.Standard.A1.Flex (ARM), 1 OCPU, 6 GB, Melbourne       |
| OS       | Ubuntu 24.04 (aarch64), user `ubuntu`                    |
| Domain   | `otp.adegobeep.com` → A record (Vercel DNS) to the VM IP |
| Files    | `/opt/otp` (compose, Caddyfile, router config, graph)    |

- A budget alert ($1) catches anything outside Always Free.
- PAYG accounts keep the Always Free limits and aren't reclaimed when idle.
- One-time setup: `otp/setup-vm.sh` (Docker).

### Firewall: two layers

Both must allow 80 and 443:

1. Oracle console → VCN → **Security List** ingress rules.
2. The VM's **iptables** (rule saved with `netfilter-persistent`).

### SSH

The deploy key lives only in GitHub secrets and on your Mac (`~/.ssh`), as a
`Host otp` entry in `~/.ssh/config`. Then `ssh otp` works.

## Deploy workflow

`.github/workflows/otp-graph.yml`

| Trigger                       | When                                    |
| ----------------------------- | --------------------------------------- |
| `workflow_run` of Update GTFS | After a successful GTFS update          |
| `workflow_dispatch`           | By hand; `force` rebuilds the same GTFS |

Steps:

1. Compare the GTFS `version.txt` with `/opt/otp/.gtfs-version`. If they're
   the same and not forced, stop.
2. Download `streetGraph.obj` from the `otp-street-2.9.0` release.
    - OSM streets change rarely, and building them needs more memory than
      the VM has, so they're built by hand once.
3. Build the transit graph on the runner (`--loadStreet --save`, 3 GB heap).
4. Copy the graph and config to the VM, then `docker compose up -d` and
   restart OTP. OTP is down for a few seconds; the app uses Google meanwhile.
5. On failure, post to Discord. OTP keeps the old graph.

Secrets (Production environment): `OTP_VM_HOST`, `OTP_VM_USER`,
`OTP_VM_SSH_KEY`, `OTP_VM_KNOWN_HOSTS`.

The workflow file must be on the default branch (`dev`) to run by hand.

## App side

- `OTP_URL=https://otp.adegobeep.com` in Vercel (Production). Without it,
  only Google is used.
- `/api/directions` asks for up to 5 itineraries in a 6-hour window, then
  matches GTFS trips and adds live times as before.
- OTP gives GTFS trip ids, so rides match better than with Google.

## Checks

```bash
# 405 is fine for GET: the endpoint takes POST only
curl -s -X POST https://otp.adegobeep.com/otp/gtfs/v1 \
  -H 'content-type: application/json' \
  -d '{"query":"{ feeds { feedId } }"}'
```

```bash
ssh otp 'docker ps; cat /opt/otp/.gtfs-version'
```

| Problem                       | Look at                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Domain doesn't connect        | Both firewall layers, `docker ps`, DNS A record           |
| OTP answers, app still Google | `OTP_URL` set and the deployment rebuilt after setting it |
| Old timetable in OTP          | Last otp-graph run; run it with `force`                   |
