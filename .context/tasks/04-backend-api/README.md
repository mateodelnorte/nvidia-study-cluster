---
title: "04: Backend API"
created: 2025-12-16
modified: 2025-12-16
status: done
priority: high
owner: mattwwalters
assignee: claude-agent
tags: [backend, api, express, typescript, metrics, alerts]
dependencies: [02-docker-compose-services, 05-frontend]
---

## Overview

Build a backend API to provide:
1. Historical metrics storage (GPU & Slurm data over time)
2. Alert configuration and notification
3. Cluster management endpoints
4. API for AI agent (Task 06) to interact with

## Goals

- [ ] Set up Express.js + TypeScript project
- [ ] Implement metrics collection and storage
- [ ] Create REST API for metrics history
- [ ] Add alert configuration endpoints
- [ ] Integrate with frontend
- [ ] Docker container for backend service

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                                │
│  └── GET /api/metrics/history                                   │
│  └── GET /api/alerts                                            │
│  └── POST /api/alerts                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend API (Express + TypeScript)                              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Metrics    │  │   Alerts    │  │  Cluster    │             │
│  │  Service    │  │   Service   │  │  Service    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────┐               │
│  │            SQLite (metrics.db)              │               │
│  └─────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
              Polls metrics from RunPod
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  RunPod Pods                                                     │
│  ├── GPU Metrics (:9400)                                        │
│  └── Slurm Metrics (:9341)                                      │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/current` | Latest metrics snapshot |
| GET | `/api/metrics/history` | Historical metrics with time range |
| GET | `/api/metrics/gpu/:nodeId` | GPU metrics for specific node |
| GET | `/api/metrics/slurm` | Current Slurm cluster status |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List all alert rules |
| POST | `/api/alerts` | Create new alert rule |
| PUT | `/api/alerts/:id` | Update alert rule |
| DELETE | `/api/alerts/:id` | Delete alert rule |
| GET | `/api/alerts/history` | Alert firing history |

### Cluster

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cluster/status` | Overall cluster health |
| GET | `/api/cluster/nodes` | List all nodes |
| POST | `/api/cluster/jobs` | Submit Slurm job (future) |

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** SQLite (simple, no external deps)
- **Validation:** Zod
- **Testing:** Vitest

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── config.ts             # Configuration
│   ├── routes/
│   │   ├── metrics.ts        # Metrics endpoints
│   │   ├── alerts.ts         # Alert endpoints
│   │   └── cluster.ts        # Cluster endpoints
│   ├── services/
│   │   ├── metrics-collector.ts  # Polls RunPod metrics
│   │   ├── metrics-store.ts      # SQLite storage
│   │   └── alert-evaluator.ts    # Checks alert conditions
│   ├── models/
│   │   ├── metrics.ts        # Metric types
│   │   └── alerts.ts         # Alert types
│   └── lib/
│       ├── prometheus-parser.ts  # Parse Prometheus format
│       └── db.ts                 # SQLite wrapper
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## Data Models

### MetricSnapshot

```typescript
interface MetricSnapshot {
  id: number;
  timestamp: Date;
  nodeId: string;
  gpuIndex: number;
  utilization: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  temperatureC: number;
  powerUsageW: number;
}
```

### AlertRule

```typescript
interface AlertRule {
  id: string;
  name: string;
  metric: string;          // e.g., "gpu_utilization"
  condition: "gt" | "lt" | "eq";
  threshold: number;
  duration: number;        // seconds
  nodeFilter?: string;     // regex for node matching
  enabled: boolean;
  createdAt: Date;
}
```

### AlertEvent

```typescript
interface AlertEvent {
  id: number;
  ruleId: string;
  nodeId: string;
  value: number;
  firedAt: Date;
  resolvedAt?: Date;
}
```

## Implementation Phases

### Phase 1: Project Setup
- Initialize Node.js + TypeScript project
- Configure ESLint, Prettier, Vitest
- Set up Express with basic health endpoint
- Docker container configuration

### Phase 2: Metrics Collection
- Prometheus format parser (reuse from frontend)
- Background collector service
- SQLite storage for time-series data
- Retention policy (7 days default)

### Phase 3: REST API
- Metrics history endpoints
- Alert CRUD endpoints
- Request validation with Zod
- Error handling middleware

### Phase 4: Alert Engine
- Condition evaluation
- Duration tracking (alert must persist for N seconds)
- Alert event storage
- Future: webhook notifications

### Phase 5: Integration
- Update frontend to use backend API
- Add historical charts
- Display alert status

## Configuration

```typescript
// config.ts
export const config = {
  port: process.env.PORT || 8080,

  // Metrics collection
  gpuEndpoints: process.env.GPU_ENDPOINTS?.split(',') || [],
  slurmEndpoint: process.env.SLURM_ENDPOINT,
  collectInterval: 10000,  // 10 seconds

  // Storage
  dbPath: process.env.DB_PATH || './data/metrics.db',
  retentionDays: 7,

  // Alerts
  evaluationInterval: 30000,  // 30 seconds
};
```

## Success Criteria

- [x] Backend starts and serves `/health` endpoint
- [x] Metrics collected from RunPod every 10 seconds
- [x] Historical data queryable via API
- [x] Alerts can be created and trigger on thresholds
- [x] Frontend displays historical charts
- [x] Docker container works in compose stack

## Interview Talking Points

1. **Full-Stack Architecture:** "The backend provides API abstraction, allowing the frontend to focus on presentation while enabling features like historical data and alerting."

2. **Time-Series Storage:** "I implemented simple time-series storage with SQLite, demonstrating understanding of metrics retention and querying patterns."

3. **Alert Engine:** "The alert evaluator shows understanding of operational concerns - not just displaying data, but acting on it when thresholds are breached."

4. **API Design:** "RESTful endpoints follow standard patterns, with proper validation and error handling."

## Related Documents

- [Task 02 README](../02-docker-compose-services/README.md) - Observability stack
- [Task 05 README](../05-frontend/README.md) - Frontend (when created)
- [progress.md](../../overridable/progress.md) - Overall status
