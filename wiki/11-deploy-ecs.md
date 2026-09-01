# Deploy on AWS ECS

This page is for operators running Kasie on AWS ECS Fargate (Amazon's serverless container service: you provide container images and AWS runs them without you managing hosts). It covers the shipped task definition, secrets, and an honest note about SQS.

## The shipped task definition

`deploy/ecs/task-definition.json` is a starting template, not a turnkey file: replace `ACCOUNT` and `REGION` placeholders and the IAM role ARNs before registering it. It defines one Fargate task (512 CPU units, 1024 MB memory) with two containers built from the same image:

| Container | Command | Purpose |
|---|---|---|
| `kasie-web` | Image default (`node server.js`) | The Next.js app, port 3000. Put it behind an Application Load Balancer with TLS. |
| `kasie-worker` | `node dist/main.js` | Queue poller and scheduler. As with [Docker](10-deploy-docker.md), the worker ticks the scheduler internally, so no external cron or EventBridge rule is required. |

Secrets come from AWS Secrets Manager via the `secrets` blocks: `DATABASE_URL` and `ENCRYPTION_KEY` for web, `DATABASE_URL` and `QUEUE_URL` for the worker. Logs go to CloudWatch (`/ecs/kasie-web` and `/ecs/kasie-worker`).

## Honest note: SQS is not implemented yet

The template sets `QUEUE_PROVIDER=sqs` and wires a `QUEUE_URL` secret, anticipating an SQS-backed queue (SQS is AWS's managed message queue). The env schema in `src/lib/env/index.ts` accepts both. But `src/lib/queue/index.ts` has no SQS provider: any value other than `memory` falls through to the Postgres queue. So today, `QUEUE_PROVIDER=sqs` silently runs on the `kasie_queue_jobs` table and `QUEUE_URL` is read by nothing.

Recommendation: set `QUEUE_PROVIDER=postgres` explicitly and drop the `QUEUE_URL` secret until an SQS provider ships. The Postgres queue is the production default and works fine here since the worker is always on.

## Setup steps

1. **Build and push the image** using the shared Dockerfile:

```bash
cd kasie
aws ecr create-repository --repository-name kasie
docker build -f deploy/docker/Dockerfile -t ACCOUNT.dkr.ecr.REGION.amazonaws.com/kasie:latest .
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/kasie:latest
```

2. **Create the database.** Neon is the recommended Postgres (the runtime client is the Neon HTTP driver; see the caveat in [Deploy with Docker](10-deploy-docker.md) before considering RDS). Run migrations from your machine or a CI step:

```bash
DATABASE_URL="postgresql://...neon.tech/kasie?sslmode=require" npm run db:migrate
```

3. **Store secrets** in Secrets Manager and reference their ARNs in the task definition. Beyond the template's `DATABASE_URL` and `ENCRYPTION_KEY`, the image runs with `NODE_ENV=production`, so the env loader fails closed without `AUTH_SECRET` and `CRON_SECRET`; add both as secrets on `kasie-web`. Add `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `AI_GATEWAY_URL`, `AI_GATEWAY_API_KEY`, and Pipedream keys as your setup requires. Full reference: [Environment Variables](7-environment-variables.md).

4. **Register and run:**

```bash
aws ecs register-task-definition --cli-input-json file://deploy/ecs/task-definition.json
aws ecs create-service \
  --cluster your-cluster \
  --service-name kasie \
  --task-definition kasie \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=ENABLED}"
```

Attach the service to a target group on port 3000 behind an ALB with an HTTPS listener, and set `APP_URL` to the public URL.

5. **Finish setup** at `https://your-domain/onboarding` after configuring the Slack app ([Slack App Setup](2-slack-app-setup.md), [Onboarding](6-onboarding.md)).

## Operating notes

- **Scaling:** the web container scales horizontally without issues. Multiple workers also coexist safely at the queue level for practical purposes, and schedule claims are atomic, so scheduled tasks never double-fire.
- **Health:** point the ALB health check at `/`. Watch CloudWatch for `worker started`, `job dequeued`, and `run failed` log lines.
- **Cron heartbeat:** not needed here (the worker ticks internally), but `POST /api/cron/heartbeat` with `Authorization: Bearer $CRON_SECRET` remains available, for example from EventBridge Scheduler as a belt-and-suspenders trigger. Concurrent triggers are safe.
- **Upgrades:** push a new image tag, register a new task definition revision, update the service. Run `npm run db:migrate` before rolling out releases that include migrations.
