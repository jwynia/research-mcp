# Package Specification

## Purpose
This document provides detailed specifications for the additional dependencies required by the search indexing system.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The search indexing system requires several additional dependencies beyond what is already included in the project. These dependencies enable SQLite database access, full-text search, scheduled indexing, and content processing.

### Required Dependencies

#### Core Database Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `better-sqlite3` | `^8.5.0` | SQLite database access with better performance | Native module that requires compilation |
| `sqlite3` | `^5.1.6` | Alternative SQLite driver (fallback) | Pure JavaScript implementation |

#### Content Processing Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `turndown` | `^7.1.2` | HTML to Markdown conversion | Already included in project |
| `jsdom` | `^24.0.0` | DOM manipulation for HTML processing | Already included in project |
| `@mozilla/readability` | `^0.5.0` | Extract main content from HTML | Already included in project |

#### Scheduling and File System Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `node-schedule` | `^2.1.1` | Cron-based scheduling for indexing | New dependency |
| `fs-extra` | `^11.3.0` | Enhanced file system operations | Already included in project |

#### Utility Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `crypto` | Built-in | Generate document IDs | Node.js built-in module |
| `path` | Built-in | File path manipulation | Node.js built-in module |

### Development Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@types/better-sqlite3` | `^7.6.8` | TypeScript definitions for better-sqlite3 | For development only |
| `@types/node-schedule` | `^2.1.5` | TypeScript definitions for node-schedule | For development only |

### Installation

To install the required dependencies, add the following to the project's package.json file:

```json
{
  "dependencies": {
    "better-sqlite3": "^8.5.0",
    "node-schedule": "^2.1.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node-schedule": "^2.1.5"
  }
}
```

Then run:

```bash
npm install
```

### Alternative Configurations

#### Using sqlite3 Instead of better-sqlite3

If there are issues with the native compilation of better-sqlite3, the sqlite3 package can be used as an alternative:

```json
{
  "dependencies": {
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "@types/sqlite3": "^3.1.11"
  }
}
```

The database module would need to be adjusted to use the sqlite3 API instead of better-sqlite3.

#### Optional Visualization Dependencies

For enhanced citation graph visualization, the following packages could be added:

```json
{
  "dependencies": {
    "d3": "^7.8.5"
  }
}
```

### Implementation Considerations

#### Native Module Compilation

The better-sqlite3 package requires compilation of native code, which may require additional system dependencies:

- On Linux: `apt-get install python build-essential`
- On macOS: Xcode Command Line Tools
- On Windows: Visual Studio Build Tools

#### SQLite Extensions

The SQLite database should be configured with the FTS5 extension enabled. This is typically included in the default SQLite build, but may need to be explicitly enabled in some environments.

#### File System Permissions

The search indexing system requires read access to the research and URL content archives, as well as read/write access to the data directory where the SQLite database will be stored.

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Technical considerations section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for dependencies
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Database module uses these dependencies

## Navigation Guide
- **When to Use:** When implementing the search indexing system and adding required dependencies
- **Next Steps:** Update package.json with the specified dependencies
- **Related Tasks:** Database implementation, indexing trigger implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of package specification