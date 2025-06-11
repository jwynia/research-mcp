# Docker Integration for Search Indexing

## Purpose
This document provides guidance on integrating the search indexing system with Docker, including scheduling and persistence considerations.

## Classification
- **Domain:** Infrastructure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The search indexing system needs to be properly integrated with the Docker environment to ensure:
1. Proper persistence of the SQLite database
2. Scheduled indexing of content
3. Access to research and URL content archives
4. Efficient resource usage

### Docker Compose Integration

The existing `docker-compose.yml` file should be updated to include the necessary configuration for the search indexing system. Here's how to integrate it:

#### Volume Configuration

Add volumes for:
1. The SQLite database
2. The research archive
3. The URL content archive

```yaml
volumes:
  search-db:
    driver: local
  research-archive:
    driver: local
  url-content-archive:
    driver: local
```

#### Environment Variables

Add environment variables to configure the search indexing system:

```yaml
environment:
  - SEARCH_DB_PATH=/app/data/search.db
  - RESEARCH_ARCHIVE_PATH=/app/data/research-archive
  - URL_CONTENT_ARCHIVE_PATH=/app/data/url-content-archive
  - INDEXING_SCHEDULE=0 * * * *  # Run indexing every hour
  - WATCH_FILES=true
```

#### Volume Mounts

Mount the volumes to the appropriate locations:

```yaml
volumes:
  - search-db:/app/data
  - research-archive:/app/data/research-archive
  - url-content-archive:/app/data/url-content-archive
```

### Scheduling Options

There are several approaches to scheduling indexing in a Docker environment:

#### 1. Internal Scheduling (Recommended)

Use the `node-schedule` package within the application to schedule indexing. This is the approach specified in our implementation plan and is the most flexible:

```typescript
// In indexingTrigger.ts
import schedule from 'node-schedule';

// Schedule indexing based on cron expression from environment variable
const cronSchedule = process.env.INDEXING_SCHEDULE || '0 * * * *'; // Default: every hour
schedule.scheduleJob(cronSchedule, async () => {
  try {
    await searchIndex.runIndexing();
    console.log('Scheduled indexing completed successfully');
  } catch (error) {
    console.error('Scheduled indexing failed:', error.message);
  }
});
```

This approach allows for dynamic scheduling and is contained within the application.

#### 2. Docker Cron Job

Create a separate container with a cron job that triggers indexing:

```yaml
services:
  indexer:
    image: ${DOCKER_REGISTRY-}research-mcp-indexer
    build:
      context: ./src
      dockerfile: Dockerfile.indexer
    volumes:
      - search-db:/app/data
      - research-archive:/app/data/research-archive
      - url-content-archive:/app/data/url-content-archive
    environment:
      - SEARCH_DB_PATH=/app/data/search.db
      - RESEARCH_ARCHIVE_PATH=/app/data/research-archive
      - URL_CONTENT_ARCHIVE_PATH=/app/data/url-content-archive
```

With a Dockerfile.indexer that includes:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Install cron
RUN apk add --no-cache dcron

# Add crontab file
COPY crontab /etc/crontabs/root

# Run cron in foreground
CMD ["crond", "-f", "-d", "8"]
```

And a crontab file:

```
# Run indexing every hour
0 * * * * cd /app && node dist/indexer.js
```

#### 3. Docker Compose Restart Policy

For simpler setups, you could use Docker Compose's restart policy to periodically restart the container, which would trigger indexing on startup:

```yaml
services:
  indexer:
    restart: always
    deploy:
      restart_policy:
        condition: any
        delay: 1h  # Restart every hour
```

This is less precise but simpler to implement.

### Initialization and Startup

To ensure the search indexing system is properly initialized when the container starts:

1. Add initialization code to the server startup:

```typescript
// In index.ts or server.ts
import { createSearchIndex } from './search';

async function startServer() {
  // Initialize search index
  const searchIndex = await createSearchIndex();
  
  // Run initial indexing
  await searchIndex.runIndexing();
  
  // Set up scheduled indexing
  searchIndex.setupTriggers({
    schedule: process.env.INDEXING_SCHEDULE,
    watchFiles: process.env.WATCH_FILES === 'true'
  });
  
  // Start the server
  // ...
}

startServer().catch(console.error);
```

2. Add a health check to ensure the search index is ready:

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('./dist/healthcheck.js')"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Resource Considerations

Indexing can be resource-intensive, especially for large archives. Consider:

1. Setting resource limits in Docker Compose:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

2. Implementing batch processing in the indexing code to limit memory usage:

```typescript
// Process documents in batches
const batchSize = 100;
for (let i = 0; i < documents.length; i += batchSize) {
  const batch = documents.slice(i, i + batchSize);
  await processDocumentBatch(batch);
}
```

### Monitoring and Logging

Add logging to track indexing operations:

```typescript
// In indexingTrigger.ts
console.log(`[${new Date().toISOString()}] Starting scheduled indexing`);
// ...
console.log(`[${new Date().toISOString()}] Indexing completed: ${stats.addedCount} added, ${stats.updatedCount} updated`);
```

Consider mounting a log volume:

```yaml
volumes:
  - ./logs:/app/logs
```

### Implementation Checklist

To complete the search indexing implementation:

1. Implement the remaining modules:
   - Archive Scanner
   - Content Processor
   - Citation Graph
   - Search API
   - Indexing Trigger
   - Main Index Module
   - MCP Tool

2. Update package.json with required dependencies:
   - better-sqlite3
   - node-schedule

3. Update Docker configuration:
   - Add volumes for database and archives
   - Configure environment variables
   - Set up health checks

4. Integrate with server startup:
   - Initialize search index
   - Run initial indexing
   - Set up scheduled indexing

5. Test the implementation:
   - Verify database creation
   - Test manual indexing
   - Test scheduled indexing
   - Test search functionality

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Technical considerations section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan
  - [elements/search_indexing/indexing_trigger_specification.md](indexing_trigger_specification.md) - uses - Indexing trigger specification

## Navigation Guide
- **When to Use:** When implementing the search indexing system in a Docker environment
- **Next Steps:** Update Docker configuration and implement remaining modules
- **Related Tasks:** Docker configuration, scheduled task implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of Docker integration guide