# Cleanflow Feature Guide

## Overview

Cleanflow is a data operations workspace that combines data intake, quality control, transformation, enrichment-style cleanup, matching, pricing analysis, visualization, and orchestration inside one application. The product is structured as a feature-based workspace rather than a single pipeline screen, which means users can solve one specific problem at a time or move the same dataset through several modules in sequence.

At a high level, Cleanflow supports three kinds of work:

1. Data quality and preparation work, such as validation, cleaning, schema mapping, and matching.
2. Data acquisition and intelligence work, such as web scraping, pricing intelligence, and AI-assisted visualization.
3. Workflow management work, such as reusable repository templates, pipeline design, saved history, database connections, usage tracking, and run monitoring.

The app uses a React frontend with feature-specific builders and a FastAPI backend with separate endpoints for validation, cleaning, enrichment, mapping, scraping, matching, pricing, visualization, repository sharing, authentication, payment upgrade, job history, and saved database connections.

## Platform Foundation

Before a user enters a specific feature, Cleanflow already provides several platform-level capabilities that support almost every workflow.

### Authentication and workspace access

Cleanflow supports account registration, login, JWT-based sessions, and OTP email verification. New accounts are created with profile fields such as full name, phone number, professional field, country, and company name. If a user registers or tries to log in before verification is complete, the backend triggers OTP verification and requires a successful code submission before issuing an access token.

This gives the app a real gated workspace model rather than anonymous feature access. Authenticated users are routed into the dashboard and can then use history, connections, global repository publishing, and protected data services.

### Data intake and reusable session model

Several features share a common session-based pattern. A user uploads a CSV or Excel file, or loads data from a saved database connection, and Cleanflow creates a session that holds the active dataset in memory. Once the session exists, downstream tools can preview, validate, transform, export, or analyze the same dataset without forcing the user to re-upload it immediately.

For file-based ingestion, the app supports:

- CSV upload
- Excel upload
- drag-and-drop upload
- delimiter selection for CSVs, including custom separators

For database-based ingestion, the app supports saved connections and table discovery. Users can choose a saved connection, browse tables, and run SQL queries to create a dataset session from a live source.

### Saved history and connection management

Authenticated users can save completed jobs into backend history. The history system stores the module name, dataset name, rules or configuration, row counts, and timestamps. This is useful because users can reopen earlier work, inspect previous logic, or resume a validation-style result context from a prior job.

Cleanflow also supports saved database connections for MSSQL, MySQL, PostgreSQL, Oracle, and SQLite. Users can:

- create a named connection
- test a connection before saving it
- list saved connections
- delete saved connections
- fetch table lists from a saved source
- query a source and import the returned data into a feature flow

This makes the product more than a file uploader. It behaves like a lightweight data operations hub that can connect to operational systems directly.

### Global Repository

One of Cleanflow’s stronger collaboration features is the Global Repository. Instead of treating every rule or cleanup step as one-off work, the app allows users to publish reusable templates that other users can consume later.

Two repository collections are implemented:

- shared validation rules
- shared cleaning operations

Each repository item stores metadata such as name, description, severity, category, space, author, and created date. Repository items can then be applied into active workspaces. If a shared template is field-agnostic, Cleanflow can prompt the user to map repository variables onto the current dataset’s actual columns before importing the rule or operation into the live workflow.

This is important because it turns Cleanflow from a single-user builder into a knowledge-sharing environment where quality logic and cleaning logic can be standardized across teams.

### Workspace dashboard, assistant, usage, and premium state

The signed-in workspace includes a dashboard, recent job overview, a usage page, and a chatbot endpoint backed by Hugging Face chat completion. There is also a simple premium upgrade endpoint that upgrades the user state to premium for demo purposes.

The usage page shows browser-tracked operational metrics such as files processed, rows processed, pipeline runs, success rate, schedule counts, feature usage mix, and free-plan limits. This gives users a quick view of how much platform activity has happened and which capabilities they are using most heavily.

## Core Feature Breakdown

### 1. Quality Validation

Quality Validation is the most fully defined data governance feature in the product. The workflow typically looks like this:

1. Upload a dataset or import it from a database.
2. Choose one or more columns.
3. Build validation rules using the rule builder.
4. Run validation on the dataset session.
5. Review row counts, failing columns, rule definitions, and downloadable outputs.

The rule builder is broad and supports far more than simple null checks. Current rule types include:

- data type checks for integer, float or numeric, alphabetic, alphanumeric, boolean, and date
- explicit date format validation
- minimum, maximum, and exact length checks
- greater than, less than, positive, negative, and between comparisons
- non-null and non-empty checks
- email regex validation
- custom regex validation
- allowed and disallowed value lists
- starts-with and ends-with logic
- cross-column comparisons with operators such as `==`, `!=`, `>`, `<`, `>=`, and `<=`
- custom expressions evaluated against row data

The backend validation engine is implemented with Polars, which is a strong fit for fast columnar validation on medium to large datasets. After execution, Cleanflow returns totals for valid and invalid rows, per-column statistics, and downloadable valid and error datasets. The results dashboard also supports report visualization and exporting the dashboard itself as an image.

This module is especially valuable for data onboarding, QA gates before analytics, and standard data contract enforcement.

### 2. Data Cleaning

The current frontend cleaning experience is centered on a builder called `EnrichmentBuilder`, but in practice the implemented workflow is a structured data cleaning pipeline. Users upload a dataset, configure one or more cleaning operations, preview the outcome on sample rows, then execute the pipeline on the full dataset and export the result.

The currently implemented cleaner operations are:

- `fill_nulls`
- `replace_value`
- `trim_whitespace`
- `uppercase`
- `lowercase`

`fill_nulls` supports strategies such as mean, median, minimum, maximum, or a custom replacement value. `replace_value` supports whole-cell replacement or partial text replacement depending on how the user configures the operation.

The important design choice here is that the cleaning module is multi-step and preview-driven. Instead of blindly mutating the full dataset, users can stage several operations, inspect sample output first, then commit the transformation. Cleanflow also allows these cleaning configurations to be shared via the Global Repository as reusable operation templates.

The backend also contains a separate enrichment provider system for email, phone, address, and name enrichment. Those provider endpoints exist and support preview and execution, but the main current frontend builder is oriented more toward data cleaning operations than provider-driven enrichment. In other words, the backend is already prepared for broader enrichment use cases, while the primary live UI emphasizes standardization and cleanup.

### 3. Schema Mapping

Schema Mapping is designed for restructuring one dataset into a target schema without requiring users to perform every transformation manually outside the tool. The user uploads a dataset, defines a target schema, maps source fields to target fields, previews the output, and then applies the mapping to the full dataset.

Capabilities in the current implementation include:

- entering a target schema column list
- receiving mapping suggestions based on similarity
- assigning source fields to target fields
- previewing mapped rows before execution
- applying mapping logic to the full dataset
- saving mapping jobs in history

The backend mapper supports more than simple renaming. It includes transformation and aggregation concepts, including concatenation and aggregate functions such as sum, average, count, minimum, and maximum. This makes the mapper useful both for normalization and for producing downstream-ready exports with a different column structure than the source system.

This module is particularly useful when a customer has one operational source format but needs to load data into another system with a fixed template.

### 4. Web Scraping

The Web Scraping feature lets users create datasets from websites using predefined scraping templates. The experience is intentionally structured:

1. Choose a scraping template.
2. Preview a single URL.
3. Run batch scraping against multiple URLs.
4. Receive a structured dataset that can feed later Cleanflow modules.

The currently implemented templates include:

- Amazon Product
- News Article
- LinkedIn Profile

Each template exposes the fields it knows how to extract. For example, the Amazon template includes items such as title, price, rating, review count, availability, and description. The execution result is not just a download; the backend creates a new dataset session from the scraped records so the user can immediately push the output into validation, cleaning, mapping, visualization, or other downstream steps.

This turns scraping into a first-class ingestion capability rather than a disconnected utility.

### 5. Data Matching

Data Matching is built for linking records across two datasets. The user can load both datasets from files or databases, define one or more matching rules, preview likely matches, run the full process in the background, poll progress, review results, and export matched output.

Implemented matching algorithms include:

- exact matching
- fuzzy matching
- cosine similarity
- jaccard similarity

Each rule can target a specific pair of columns and use a threshold. This allows users to combine strict and fuzzy logic, for example matching on exact SKU plus fuzzy product title, or combining company name and address similarity rules.

The backend handles long-running execution asynchronously, exposes progress polling, and supports CSV or Excel export of results. The feature is appropriate for duplicate detection, customer record linking, vendor list consolidation, catalog matching, and master data preparation.

### 6. Pricing Intelligence

Pricing Intelligence is one of the most advanced modules in the app. It is designed for comparing a user’s product catalog against competitor datasets and generating recommended prices based on match quality, strategy settings, business constraints, and optional dynamic signals.

The workflow is more involved than the basic matching feature:

1. Load the internal catalog and one or more competitor sources.
2. Define match rules between internal and competitor datasets.
3. Review match quality and suggested competitor pairings.
4. Configure pricing strategy, limits, and signal settings.
5. Run pricing analysis.
6. Review recommendation tables and export results.

The implementation includes support for:

- multiple competitor datasets
- configurable matching algorithms
- match review before execution
- pricing strategies such as matching the market, pricing below market, or pricing above market
- adjustment values
- minimum margin rules and cost-floor protection
- demand, stock, and review-based dynamic signals
- price elasticity simulation
- pricing limits and rounding
- summary metrics such as coverage, average margin, average change, increases, and decreases

The output is not just a raw table. The module returns pricing rows with current price, recommended price, competitor min and average values, margin percentage, recommended action, signals, and explanatory notes. This makes it usable for analyst review rather than just machine output.

### 7. AI Visualizer

The AI Visualizer converts a dataset into dashboard-style outputs with KPIs, charts, summaries, and insights. Users upload a dataset and optionally provide a natural-language prompt such as asking for top categories, trends, or numeric relationships.

The feature supports two analysis modes:

- rule-based dashboard generation
- AI-assisted dashboard generation using Hugging Face with Qwen

When AI is available, the backend asks the model to propose chart specifications based on the schema and the user prompt. If AI is unavailable or fails, the system falls back to rule-based heuristics. Supported chart families include bar, line, area, pie, scatter, and boolean distribution views.

The frontend then renders:

- KPI cards
- dashboard summary
- multiple charts
- column analysis
- dataset preview
- downloadable chart data
- exportable dashboard image

This module gives users a fast way to inspect a newly uploaded dataset without immediately moving into another transformation feature.

## Workflow and Orchestration Features

### 8. Pipeline Builder

The Pipeline Builder provides a drag-and-drop React Flow canvas where users can assemble multi-step workflows visually. The current node palette includes dataset, scraper, cleaner, validation, mapper, matching, and export nodes. Users configure nodes in side panels, connect them into a graph, and send the graph to the backend orchestrator.

The backend pipeline runner currently executes:

- dataset
- cleaner
- validation
- export

The UI is already prepared for additional node types such as scraper, mapper, and matching, but the current backend orchestrator logs unimplemented execution for some of those nodes. That means the feature is best described as an extensible workflow canvas with a partially implemented execution engine today.

Even in its current state, the builder is useful because it serializes workflow design, records pipeline runs locally, stores logs, and can produce an output file plus preview data from successful runs.

### 9. Scheduler and Pipeline Runs

Cleanflow also includes browser-managed workflow operations around pipelines.

The Scheduler feature allows users to define recurring schedules with:

- schedule name
- pipeline name
- frequency
- runtime
- notes
- status such as active or paused

Available frequencies include hourly, daily, weekly, and monthly. In the current codebase, these schedules are stored in local storage rather than being executed by a backend scheduler service. So this feature is best understood as schedule management UI and planning support rather than full backend automation at this stage.

The Pipeline Runs screen reads locally stored run records and provides:

- total, completed, running, and failed counts
- success-rate visualization
- run-by-run status cards
- execution logs
- duration tracking
- output download links
- deletion and filtering

Together, Pipeline Builder, Scheduler, and Pipeline Runs create the beginnings of an orchestration layer around Cleanflow’s core data features.

## Account, Support, and Current Scope Notes

### Profile and account UI

The frontend includes an account settings area with tabs for history, saved connections, profile, security, and account information. The UI supports editing profile fields, changing passwords, reviewing job history, managing database connections, signing out, and showing a danger-zone delete-account panel.

However, in the backend route set inspected for this guide, account update routes such as `/users/profile` and `/users/change-password` were not present. That suggests the profile and security screens are implemented in the UI and partly wired for future expansion, while the currently confirmed backend-backed account flows are registration, login, OTP verification, resend OTP, current-user lookup, and premium upgrade.

### Premium and billing

Premium state exists in the user model, and there is a payment route that upgrades a user to premium. In the current code, that upgrade is a simplified backend action rather than a full billing gateway integration. It is enough to demonstrate plan-state behavior, but it should be described as a basic upgrade path rather than a finished subscription platform.

### Practical summary

Cleanflow is already strongest in these areas:

- dataset validation
- staged cleaning
- schema mapping
- template-based scraping
- record matching
- pricing analysis
- AI or heuristic visualization
- reusable repository templates
- history and database connection management

Areas that look intentionally in progress or partly browser-managed today include:

- full enrichment-provider UX exposure
- complete pipeline execution coverage for every node type
- backend-driven scheduling automation
- fully implemented account profile and password update APIs

## Conclusion

Cleanflow is not just a single-purpose validator or dashboard generator. It is a multi-feature data operations workspace that helps users ingest, inspect, clean, validate, reshape, enrich, compare, visualize, and orchestrate data work inside one product. Its current architecture already supports serious operational workflows, especially for quality control and structured data processing, while also showing a clear path toward deeper orchestration, collaboration, and intelligence features over time.
