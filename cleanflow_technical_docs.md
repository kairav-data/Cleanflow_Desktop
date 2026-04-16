# CleanFlow — In-Depth Technical Documentation

> **Version:** Current (April 2026) &nbsp;|&nbsp; **Prepared by:** Antigravity AI  
> **Purpose:** Complete system architecture, feature internals, data flows, and technology stack reference.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Infrastructure & Deployment](#4-infrastructure--deployment)
5. [Database Schema](#5-database-schema)
6. [Authentication & User Management](#6-authentication--user-management)
7. [Data Ingestion Layer](#7-data-ingestion-layer)
8. [Feature Deep-Dives](#8-feature-deep-dives)
   - 8.1 [Quality Validation](#81-quality-validation)
   - 8.2 [Data Cleaning](#82-data-cleaning)
   - 8.3 [Schema Mapping](#83-schema-mapping)
   - 8.4 [Data Matching](#84-data-matching)
   - 8.5 [Data Enrichment](#85-data-enrichment)
   - 8.6 [Web Scraper](#86-web-scraper)
   - 8.7 [Pricing Intelligence](#87-pricing-intelligence)
   - 8.8 [AI Data Visualizer](#88-ai-data-visualizer)
   - 8.9 [Pipeline Builder](#89-pipeline-builder)
   - 8.10 [Global Repository](#810-global-repository)
   - 8.11 [AI Chatbot (Gwen)](#811-ai-chatbot-gwen)
9. [API Reference Summary](#9-api-reference-summary)
10. [Session Management](#10-session-management)
11. [Email & Notification System](#11-email--notification-system)
12. [Job History & Audit Trail](#12-job-history--audit-trail)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Security Considerations](#15-security-considerations)

---

## 1. System Overview

CleanFlow is a **full-stack, cloud-capable data quality and processing platform**. It allows users to:

- **Upload** CSV / Excel datasets or query them directly from connected databases (PostgreSQL, MySQL, MSSQL, SQLite, Oracle).
- **Validate** data quality using a rich rule engine (type checks, regex, range, null checks, cross-column comparisons).
- **Clean** data with configurable operations (fill nulls, trim, case conversion, value replacement).
- **Map** schemas between different column structures with auto-suggestions and transformations.
- **Match** records across two datasets using multiple similarity algorithms.
- **Enrich** data with derived fields (email parsing, phone formatting, address normalization, name splitting).
- **Visualize** data interactively with AI-generated charts.
- **Scrape** web data using templates or custom CSS selectors.
- **Price Intelligence** — compare product pricing across datasets.
- **Build Pipelines** — chain multiple operations visually in a drag-and-drop graph, schedule them, and track run history.
- **Global Repository** — save and share reusable rule sets and cleaning operation sets across the team.
- **Chat with Gwen** — an embedded AI assistant that answers product-specific questions using a RAG-like feature guide.

---

## 2. Technology Stack

### 2.1 Backend

| Layer | Technology | Purpose |
|---|---|---|
| **Web Framework** | FastAPI (Python) | REST API, async route handling |
| **ASGI Server** | Uvicorn | Production server inside Docker |
| **Data Engine (primary)** | **Polars** | All data transformations, validation, matching, export. Used for columnar, lazy, and parallel processing. |
| **Data Engine (fallback/legacy)** | Pandas | DB ingestion fallback if Polars connectorx is unavailable |
| **Database ORM** | SQLAlchemy | PostgreSQL schema & query abstraction |
| **Primary Database** | **PostgreSQL** | All persistent data: users, jobs, pipelines, connections, rule repositories |
| **Auth** | python-jose (JWT HS256) + passlib bcrypt | Stateless bearer token auth with OTP verification |
| **Matching Engine** | RapidFuzz + scikit-learn | Levenshtein fuzzy matching and cosine similarity |
| **Similarity** | NumPy | Jaccard set operations, matrix math |
| **Email** | Resend API (OTP) + SMTP (pipeline notifications) | Transactional emails |
| **AI Inference** | Hugging Face InferenceClient | Chatbot LLM calls (Qwen2.5-72B-Instruct) |
| **AI Visualization** | Hugging Face InferenceClient | Chart auto-generation from data context |
| **Logging** | Python logging (custom `setup_logger`) | Structured logging across all modules |
| **Background Tasks** | FastAPI BackgroundTasks | Async matching execution |

### 2.2 Frontend

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | React 19 (JSX + TSX) | UI component tree |
| **Build Tool** | Vite 7 | HMR dev server, production bundling |
| **Styling** | Tailwind CSS 3 + custom CSS | Utility-first styling |
| **Animation** | Framer Motion | Page transitions, micro-animations |
| **Charts** | Recharts | Data visualizations |
| **Pipeline Canvas** | @xyflow/react (React Flow) | Drag-and-drop DAG pipeline builder |
| **Icons** | Lucide React | Consistent icon set |
| **HTTP Client** | Axios | All API calls |
| **Markdown Renderer** | react-markdown | Chatbot response rendering |
| **Excel** | xlsx (SheetJS) + html2canvas | Client-side Excel import/export |

### 2.3 Infrastructure

| Layer | Technology | Notes |
|---|---|---|
| **Container Runtime** | Docker + Docker Compose | Multi-service orchestration |
| **Production Hosting** | Backend: Render.com | Auto-deploys from Git |
| **Frontend Hosting** | Vercel | CDN-distributed React SPA |
| **Database Hosting** | Render PostgreSQL (or Docker container) | Persistent storage |
| **Networking** | Docker bridge network `cleanflow-net` | Internal service-to-service communication |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER / CLIENT                        │
│   React 19 SPA  (Vite, TailwindCSS, Framer Motion, Recharts)   │
│               served from Vercel / Docker port 5173             │
└────────────────────────────┬────────────────────────────────────┘
                             │  HTTPS / HTTP (Axios REST calls)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND  (port 8000)                 │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  auth.py │  │  main.py  │  │pipeline_   │  │ repo_      │  │
│  │  /token  │  │  /upload  │  │router.py   │  │ router.py  │  │
│  │  /register│ │  /validate│  │/pipeline/* │  │/repo/*     │  │
│  │  /verify  │  │  /features│  └────────────┘  └────────────┘  │
│  └──────────┘  └───────────┘                                    │
│                     │                                           │
│  ┌──────────────────┼─────────────────────────────────────┐    │
│  │                 FEATURES LAYER                          │    │
│  │  validation.py  cleaner.py  matching.py  mapper.py     │    │
│  │  enrichment.py  scraper.py  visualizer.py  pricing.py  │    │
│  │  pipeline_runner.py                                     │    │
│  └──────────────────┬─────────────────────────────────────┘    │
│                     │ Polars DataFrames                         │
│  ┌──────────────────▼─────────────────────────────────────┐    │
│  │      IN-MEMORY SESSION STORE  (dict: sessions{})       │    │
│  │    session_id → ValidationEngine / DataMatcher / ...   │    │
│  └──────────────────┬─────────────────────────────────────┘    │
└─────────────────────┼───────────────────────────────────────────┘
                      │ SQLAlchemy ORM
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE  (port 5432)                   │
│  users · validation_jobs · db_connections                       │
│  quality_validation_rule_repo · cleaning_operation_repo         │
│  saved_pipelines · pipeline_schedules · pipeline_runs           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Infrastructure & Deployment

### 4.1 Docker Services

**`docker-compose.yml`** defines three logical layers:

```yaml
services:
  backend:           # FastAPI on port 8000
  frontend:          # Vite/React on port 5173
  
networks:
  cleanflow-net:     # Bridge network for inter-container communication
```

> [!NOTE]
> There is **no PostgreSQL container** in the current Docker Compose. PostgreSQL is expected to be provided externally (Render.com managed DB or a localhost instance) via the `DATABASE_URL` environment variable.

### 4.2 Environment Variables

| Variable | Service | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string (default: `postgresql://user:password@postgres:5432/cleanflow_db`) |
| `AUTH_SECRET_KEY` | Backend | JWT signing secret (HS256) |
| `HF_API_KEY` | Backend | Hugging Face API key for chatbot & visualizer |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_PORT` | Backend | SMTP credentials for pipeline email nodes |
| `RESEND_API_KEY` | Backend | Resend.com API key for OTP emails |
| `VITE_API_BASE_URL` | Frontend Build | Backend URL the browser will call |
| `VITE_HF_API_KEY` | Frontend | Passed to backend container as `HF_API_KEY` |
| `FRONTEND_URL` | Backend | Allowed CORS origin for production |

### 4.3 CORS Policy

The backend allows requests from:
- `http://localhost:3000`, `http://localhost:5173` (local dev)
- `https://cleanflow-one.vercel.app`, `https://cleanflow.one`, `https://www.cleanflow.one` (production)
- Any `*.vercel.app` subdomain (via regex — covers PR previews automatically)
- Any URL from `FRONTEND_URL` env var

### 4.4 Lifespan & Startup

On container start, `lifespan()` in `main.py` calls `db._init_postgres()` which:
1. Retries PostgreSQL up to 10 times (5-second delay between retries)
2. Calls `Base.metadata.create_all()` to create missing tables
3. Runs a list of `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration queries for backward compatibility with older schemas (no Alembic migrations)

---

## 5. Database Schema

### Entity Relationship Overview

```
users
 ├── validation_jobs (history of runs)
 ├── db_connections (saved DB connectors)
 ├── saved_pipelines
 │    ├── pipeline_schedules
 │    └── pipeline_runs
 └── pipeline_schedules (also linked to pipelines)

quality_validation_rule_repo  (global, not user-scoped beyond authorship)
cleaning_operation_repo        (global, not user-scoped beyond authorship)
```

### 5.1 `users`

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | Auto-increment |
| `email` | String (unique) | Primary identifier |
| `full_name` | String | Optional |
| `phone_number` | String | Optional |
| `professional_field` | String | Optional |
| `country` | String | Optional |
| `company_name` | String | Optional |
| `hashed_password` | String | bcrypt hash |
| `is_premium` | Boolean | Subscription flag |
| `is_verified` | Boolean | Email OTP verification |
| `otp` | String | 6-digit OTP (nulled after verification) |
| `otp_created_at` | DateTime | For 10-minute expiry check |

### 5.2 `validation_jobs`

Stores a history record for every validation/cleaning/matching run a logged-in user performs.

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | Session ID |
| `user_email` | FK → users.email | |
| `filename` | String | Source file name or "DB: ..." |
| `status` | String | `completed`, `failed`, etc. |
| `rules` | Text (JSON) | Serialized rule array |
| `module` | String | `validation`, `cleaner`, `matching`, etc. |
| `total_rows` | Integer | |
| `valid_rows` | Integer | |
| `invalid_rows` | Integer | |
| `column_stats` | Text (JSON) | Per-column failure breakdown |
| `created_at` | DateTime | |

### 5.3 `db_connections`

Stores user-saved database connection profiles.

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | |
| `user_email` | FK → users.email | |
| `name` | String | Human-readable label |
| `db_type` | String | `postgresql`, `mysql`, `mssql`, `sqlite`, `oracle` |
| `host` | String | |
| `port` | Integer | |
| `database` | String | |
| `username` | String | |
| `password` | String | ⚠️ Stored plaintext — encrypt in production |

### 5.4 `quality_validation_rule_repo`

Global shared rule sets. Any user can read; only the author can delete.

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | |
| `name` | String | Rule set name |
| `description` | Text | |
| `severity` | String | `Standard`, `Critical`, etc. |
| `space` | String | Namespace label |
| `category` | String | `Validity`, `Format`, etc. |
| `logic_type` | String | `condition`, `expression` |
| `use_for_validation` | Boolean | |
| `definition` | Text (JSON) | Extended config |
| `rules` | Text (JSON) | Array of `{column, rule_type, params}` |
| `author_email` | String | |
| `author_name` | String | |
| `created_at` / `updated_at` | DateTime | |

### 5.5 `cleaning_operation_repo`

Mirrors `quality_validation_rule_repo` but for cleaning operations.

Key difference: stores `operations` JSON array of `{column, operation, params}` instead of validation rules.

### 5.6 `saved_pipelines`

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | |
| `user_email` | FK → users | Cascade delete |
| `name` | String | |
| `description` | Text | |
| `nodes` | Text (JSON) | Array of React Flow node objects |
| `edges` | Text (JSON) | Array of React Flow edge objects |
| `tags` | String | Comma-separated |
| `is_active` | Boolean | Soft delete flag |
| `created_at` / `updated_at` | DateTime | |

### 5.7 `pipeline_schedules`

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | |
| `pipeline_id` | FK → saved_pipelines | Cascade delete |
| `user_email` | FK → users | Cascade delete |
| `schedule_name` | String | |
| `frequency` | String | `Hourly`, `Daily`, `Weekly`, `Monthly` |
| `run_time` | String | HH:MM |
| `day_of_week` | String | e.g. `Mon` (for Weekly) |
| `day_of_month` | Integer | 1–31 (for Monthly) |
| `timezone` | String | Default UTC |
| `is_active` | Boolean | Toggle pause/resume |
| `last_run_at` / `next_run_at` | DateTime | Updated on execution |

### 5.8 `pipeline_runs`

Execution log per pipeline run.

| Column | Type | Notes |
|---|---|---|
| `id` | String (UUID) PK | |
| `pipeline_id` | FK → saved_pipelines (nullable) | SET NULL on delete |
| `user_email` | FK → users | |
| `pipeline_name` | String | Denormalized for display after delete |
| `trigger` | String | `manual` or `scheduled` |
| `status` | String | `running`, `completed`, `failed` |
| `node_count` | Integer | |
| `logs` | Text (JSON) | Array of `{node, type, status, message}` |
| `output_file` | String | Path to exported file |
| `error_message` | Text | |
| `started_at` / `finished_at` | DateTime | |
| `duration_seconds` | Float | |

---

## 6. Authentication & User Management

### 6.1 Registration Flow

```
POST /register
  → Validate unique email
  → Hash password (bcrypt, max 72 chars)
  → Save user (is_verified=False)
  → Generate 6-digit OTP
  → send_otp_email() via Resend API
  → Return 403 with detail "OTP_REQUIRED"

POST /verify-otp
  → Validate OTP + 10-minute expiry
  → Set is_verified=True
  → Nullify OTP
  → Return JWT access token

POST /resend-otp
  → Regenerate OTP
  → Resend email
```

### 6.2 Login Flow

```
POST /token  (OAuth2PasswordRequestForm)
  → Look up user by email
  → bcrypt.verify(plain, hashed)
  → If not is_verified → send new OTP → 403 OTP_REQUIRED
  → Create JWT: {sub: email, exp: now + 30 min}
  → Return Bearer token
```

### 6.3 Token Format

- Algorithm: **HS256**
- Payload: `{sub: email, exp: timestamp}`
- Expiry: **30 minutes**
- Protected routes use `Depends(get_current_user)` which decodes the JWT and fetches the user from PostgreSQL

---

## 7. Data Ingestion Layer

Every feature in CleanFlow begins with loading data into a session. Three ingestion paths exist:

### 7.1 File Upload (`POST /upload`)

```
Browser → multipart/form-data (file + delimiter)
  → Save file to ./uploads/ directory
  → PolarsValidationEngine.load_data(file_path, sep)
    → pl.read_csv() or pl.read_excel()
  → Store engine in sessions[session_id]
  → Return { session_id, filename, columns[] }
```

Supported files: `.csv`, `.txt`, `.xlsx`, `.xls`

### 7.2 Database Query Ingestion (`POST /ingest/database`)

```
Client → { connection_id, query }
  → db.get_connection(connection_id, user_email)  [PostgreSQL lookup]
  → _build_connection_string_from_dict(conn)
  → Try: pl.read_database(query, conn_str)         [Polars native]
  → Except: pandas.read_sql() → pl.from_pandas()  [Fallback]
  → Store in sessions{}
```

Supported DB types: PostgreSQL, MySQL, MSSQL, SQLite, Oracle

### 7.3 JSON Data Upload (`POST /upload-data`)

Used when the frontend sends data that was already loaded in the browser (e.g., Excel previewed client-side):

```
Client → { data: [{...}, ...], source: "string" }
  → pl.from_dicts(data)
  → Store in sessions{}
```

---

## 8. Feature Deep-Dives

### 8.1 Quality Validation

**Files:** `backend/features/validation.py`, `backend/models.py`  
**Frontend:** `frontend/src/pages/Validation.jsx`, `frontend/src/components/RuleBuilder.jsx`

#### How It Works

The **PolarsValidationEngine** uses Polars' lazy evaluation API to translate user-defined rules into vectorized column expressions.

**Step-by-step:**

1. User configures rules in `RuleBuilder.jsx` — each rule: `{column, rule_type, params}`
2. Frontend `POST /validate/{session_id}` → `ValidationConfig.rules: ValidationRule[]`
3. Backend engine iterates rules and builds a Polars expression tree:
   - `valid_condition = pl.lit(True) & rule1_expr & rule2_expr & ...`
   - `error_exprs`: list of `when(valid).then("").otherwise("[col: Failed rule]")` expressions
4. These are applied in a single `.collect()` on the lazy frame — no row-by-row iteration
5. Output: two CSVs saved to disk (`{session_id}_valid.csv`, `{session_id}_error.csv`)
6. Stats aggregations are run in a second pass using `.sum()` on inverted masks

#### Supported Rule Types (30+)

| Category | Rules |
|---|---|
| **Type & Format** | `type_check` (integer, float, alphabetic, alphanumeric, boolean, date), `date_format` |
| **Length** | `length_min`, `length_max`, `length_exact` |
| **Value Range** | `value_gt`, `value_lt`, `value_between`, `value_positive`, `value_negative` |
| **Null Checks** | `not_null` |
| **Pattern** | `regex_custom`, `regex_email`, `starts_with`, `ends_with` |
| **Domain** | `allowed_values`, `disallowed_values` |
| **Cross-Column** | `column_compare` (==, !=, >, <, >=, <=) |
| **Custom** | `custom_expression` (Python `eval()` in sandboxed context) |

#### Key Design Decision

> All rules are compiled into a single Polars lazy plan and evaluated in one `.collect()` call. This is fundamentally different from row-iteration approaches and allows the engine to process millions of rows efficiently.

---

### 8.2 Data Cleaning

**File:** `backend/features/cleaner.py`  
**Frontend:** Part of `App.jsx` workspace

#### How It Works

`DataCleaner` extends `BaseFeature` (which provides `load_data()` and `df` state). Operations are applied sequentially using Polars expressions:

| Operation | Polars Expression |
|---|---|
| `fill_nulls` (mean/median/min/max) | `pl.col(c).fill_null(pl.col(c).mean())` etc. |
| `fill_nulls` (custom) | `pl.col(c).fill_null(pl.lit(value))` |
| `replace_value` (whole) | `pl.when(col == target).then(lit(replacement)).otherwise(col)` |
| `replace_value` (partial) | `col.cast(Utf8).str.replace_all(target, replacement)` |
| `trim_whitespace` | `col.cast(Utf8).str.strip_chars()` |
| `uppercase` | `col.cast(Utf8).str.to_uppercase()` |
| `lowercase` | `col.cast(Utf8).str.to_lowercase()` |

**Preview vs Execute:** Preview runs on `.head(limit)` before applying to the full dataset.

---

### 8.3 Schema Mapping

**File:** `backend/features/mapper.py`  
**Frontend:** `frontend/src/features/SchemaMapper.jsx`

#### How It Works

`SchemaMapper` translates user-defined column mappings into a Polars `SELECT` expression list:

1. **Mappings** — `source_col → target_col` with optional transformation chain
2. **Concatenations** — `pl.concat_str([cols], separator)` → new column
3. **Aggregations** — `pl.col(c).sum()` / `.mean()` / `.count()` etc. — scalar broadcast to all rows

**Auto-Suggest:** `ColumnMatcher.suggest_mappings()` uses Python's `difflib.SequenceMatcher` to calculate string similarity between source and target column names (threshold: 0.6 cosine similarity on normalized names).

**Transformations available:**

| ID | Polars Expression |
|---|---|
| `uppercase` | `.str.to_uppercase()` |
| `lowercase` | `.str.to_lowercase()` |
| `trim` | `.str.strip_chars()` |
| `title_case` | `.str.to_titlecase()` |
| `remove_special_chars` | `.str.replace_all(r'[^a-zA-Z0-9\s]', '')` |
| `extract_numbers` | `.str.extract_all(r'\d+').list.join('')` |
| `pad_zeros` | `.str.zfill(5)` |

---

### 8.4 Data Matching

**File:** `backend/features/matching.py`  
**Frontend:** `frontend/src/features/DataMatchingBuilder.jsx`

This is the most computationally complex feature. It cross-matches records between two datasets using pluggable similarity algorithms.

#### Architecture

```
DataMatcher
  ├── datasets: Dict[str, pl.DataFrame]   — stores both datasets
  ├── progress: Dict                       — live progress tracking
  └── results: List[Dict]                 — final match records
```

#### Algorithms

| Algorithm | Library | Method | Best For | Score Type |
|---|---|---|---|---|
| **Fuzzy** | RapidFuzz | `fuzz.ratio` (Levenshtein) | Typos, name variations | 0–1 (normalized from 0–100) |
| **Exact** | Polars join | Inner join on normalized key | IDs, codes, exact duplicates | Always 1.0 |
| **Cosine Similarity** | scikit-learn `CountVectorizer` + cosine | Character n-gram (1,3) TF matrix | Longer text, descriptions | 0–1 |
| **Jaccard** | Custom Python sets | `|A∩B| / |A∪B|` on char sets | Tags, short codes | 0–1 |

#### Multi-Rule Matching Process

```
config.rules = [
  { column1, column2, algorithm, threshold },  # Rule 1
  { column1, column2, algorithm, threshold },  # Rule 2
]

For each rule:
  → run_algorithm(df1[col1], df2[col2], threshold)
  → returns: [{index1, index2, similarity_score}]
  → aggregate into: candidate_scores[(idx1, idx2)][rule_idx] = score

Final aggregation:
  → avg_score = mean(all rule scores for pair)
  → if avg_score >= global_threshold → include in results
  → annotate with confidence: High (>0.9), Medium (>0.7), Low
  → fetch full row data from both datasets
  → sort by score descending
```

#### Progress Tracking

Fuzzy/Jaccard matching runs on the main thread and updates `self.progress` every 100 (fuzzy) or 10 (Jaccard) items. The frontend polls `GET /features/matching/status/{session_id}` to display a live progress bar.

#### Background Execution

Full dataset matching runs via FastAPI `BackgroundTasks`:
```
POST /features/matching/start/{session_id}
  → BackgroundTasks.add_task(matcher.execute(config))
  → Returns immediately: { status: "started" }

GET /features/matching/status/{session_id}  → poll
GET /features/matching/results/{session_id} → fetch when complete
```

#### Export

Export is provided in **CSV** and **Excel (.xlsx)** formats. `match_details` (the per-rule score list) is stripped from the export for clean output.

---

### 8.5 Data Enrichment

**File:** `backend/features/enrichment.py`  
**Frontend:** `frontend/src/features/EnrichmentBuilder.jsx`

#### How It Works

Enrichment adds **derived columns** to a dataset based on one source column. Each provider uses `pl.col(col).map_elements(fn, return_dtype=pl.Struct)` followed by `.unnest()` to expand struct fields into individual columns.

| Provider | Source Column | Output Columns |
|---|---|---|
| **Email** | email string | `valid`, `company`, `domain`, `is_business` |
| **Phone** | phone string | `valid`, `formatted` (US format), `digits`, `length` |
| **Address** | address string | `standardized`, `zip_code`, `state`, `has_zip`, `has_state` |
| **Name** | full name string | `first_name`, `last_name`, `middle_name`, `parts` |

**Naming:** Output columns are prefixed with `{output_prefix}_{field}` — e.g., `email_enriched_domain`.

> [!NOTE]
> `map_elements` (Python UDF) is used because the regex logic in providers is too complex for pure Polars expressions. This is slower than native expressions but acceptable for the enrichment use case.

---

### 8.6 Web Scraper

**File:** `backend/features/scraper.py`  
**Frontend:** `frontend/src/features/ScraperBuilder.jsx`

#### Current State (Prototype / Template-Based)

The scraper provides a **template framework** for structured data extraction. Currently, all templates return **mock/sample data** (placeholder `parse_data()` methods). Real HTTP fetching with BeautifulSoup is marked as the next step in the code.

| Template | Fields | Target |
|---|---|---|
| `amazon_product` | title, price, rating, reviews_count, availability, description | Amazon product pages |
| `news_article` | headline, author, date, content, category | Generic news sites |
| `linkedin_profile` | name, headline, location, company, education | LinkedIn profiles |

**Custom scraping:** Users can provide their own CSS selector map. Currently returns `{key: "Extracted value for key"}` placeholders.

---

### 8.7 Pricing Intelligence

**File:** `backend/features/pricing.py`  
**Frontend:** `frontend/src/features/PricingIntelligenceBuilder.jsx`

This feature extends Data Matching specifically for **product pricing comparison** across supplier/competitor datasets. It uses the same multi-algorithm matching engine as Data Matching but adds price-specific analysis layers:

- Product name matching to find equivalent items across datasets
- Price delta calculation and percentage difference
- Pricing strategy comparisons (competitive, above-market, below-market)
- Summary statistics per matched product group

The frontend (`PricingIntelligenceBuilder.jsx` — 126KB) is the largest UI component in the system, offering side-by-side dataset views, configurable matching rules, and price analysis dashboards.

---

### 8.8 AI Data Visualizer

**File:** `backend/features/visualizer.py`  
**Frontend:** `frontend/src/features/DataVisualizer.jsx`

#### How It Works

The visualizer uses the **Hugging Face InferenceClient** to interpret natural-language chart requests against the current dataset.

**Process:**
1. User loads a dataset (CSV/DB) into a session
2. User types a chart request: *"Show me a bar chart of sales by region"*
3. Backend sends: dataset schema + sample data + user prompt to the LLM (via HF API)
4. LLM returns a JSON config describing chart type, X/Y axes, grouping, filters
5. Backend parses and returns the config + aggregated data
6. Frontend renders using **Recharts** (bar, line, pie, scatter, area charts)

The `DataVisualizer.jsx` (94KB) handles chart type selection, axis configuration, live preview, and the chat-to-chart interface.

---

### 8.9 Pipeline Builder

**Files:** `backend/features/pipeline_runner.py`, `backend/pipeline_router.py`  
**Frontend:** `frontend/src/features/PipelineBuilder.jsx` (102KB), `SchedulerBuilder.jsx`, `PipelineRuns.jsx`

#### Overview

The Pipeline Builder enables users to create **visual DAG (Directed Acyclic Graph) workflows** that chain data operations together.

#### Node Types

| Node Type | Backend Handler | Action |
|---|---|---|
| `dataset` | - | Source node — references an in-memory session |
| `cleaner` | `DataCleaner.execute()` | Applies cleaning rules |
| `validation` | `PolarsValidationEngine.validate()` | Validates and flags rows |
| `export` | `pl.write_excel()` | Writes output to `results/` |
| `email` | `send_pipeline_email()` | Sends SMTP notification |
| Other | - | Logged as `skipped` |

#### Execution Engine (`PipelineOrchestrator`)

```python
execute_graph(config):
  1. Build adjacency list + in-degree map from edges
  2. Topological sort (Kahn's algorithm / BFS)
  3. Iterate sorted node IDs:
     - Pass current_df through each node handler
     - Each step mutates current_df (Polars clone at start)
     - Append log entry per node: {node, type, status, message}
  4. Return { success, logs, preview_data (top 100), output_file }
```

#### Email Node — Macro Variables

The email node supports dynamic template variables resolved at runtime:

| Token | Resolves To |
|---|---|
| `{{TODAY_DATE}}` | `datetime.now().strftime("%Y-%m-%d %H:%M")` |
| `{{STATUS}}` | `"Success"` or `"Partial"` based on prior node statuses |
| `{{ROW_COUNT}}` | `str(len(current_df))` at the time of the email node |
| `{{PIPELINE_NAME}}` | Pipeline name from `config.pipelineName` |

#### Pipeline Persistence

Pipelines are saved as JSON (nodes + edges arrays) in `saved_pipelines` table. The React Flow canvas state is serialized verbatim.

#### Pipeline Scheduling

Schedules define **when** a pipeline should auto-run:
- Frequencies: Hourly, Daily, Weekly, Monthly
- Time: HH:MM
- Day: Day of week (Weekly) or day of month (Monthly)
- Timezone support

> [!IMPORTANT]
> The schedule records are **stored** but there is no background scheduler daemon in the current Docker Compose setup. Scheduled execution requires an external cron job or a task queue (Celery, APScheduler) to poll `next_run_at` and trigger pipeline runs.

---

### 8.10 Global Repository

**File:** `backend/repo_router.py`  
**Frontend:** `frontend/src/features/GlobalRepositoryBuilder.jsx`, `frontend/src/components/RepoSidebar.jsx`

#### Purpose

Allows users to **save, share, and reuse** named rule sets and cleaning operation sets across the team globally.

**Rule Repo** — stores `QualityValidationRule[]` as JSON. Any user can browse and apply them to their own validation sessions.

**Cleaning Op Repo** — stores `CleaningOperation[]` as JSON. Same global visibility model.

**Access Control:**
- **Read:** Unrestricted — any authenticated user can list all repos
- **Write (create):** Any authenticated user
- **Delete:** Only the `author_email` owner can delete their own entries

#### API Endpoints

```
GET  /repo/rules           → list all rule repos
POST /repo/rules           → save new rule repo (auth required)
DELETE /repo/rules/{id}    → delete own rule repo (auth required)

GET  /repo/cleaning        → list all cleaning op repos
POST /repo/cleaning        → save new cleaning op repo (auth required)
DELETE /repo/cleaning/{id} → delete own cleaning op repo (auth required)
```

---

### 8.11 AI Chatbot (Gwen)

**File:** `backend/chatbot.py`  
**Frontend:** `frontend/src/components/ChatBot.tsx`

#### Architecture

Gwen is a **RAG-lite (Retrieval-Augmented Generation)** chatbot that answers questions specifically about CleanFlow.

**Knowledge Base:** `CLEANFLOW_FEATURE_GUIDE.md` — a structured Markdown guide at the project root. Loaded once at startup via `@lru_cache`.

**Retrieval Process:**
```
User message(s)
  → tokenize (regex, stopword filter)
  → score each guide section: TF overlap + heading bonus + exact match bonus
  → select top 4 sections (max 6000 chars total)
  → always prepend "Overview" section if not already included
  → build system prompt: instructions + guide context
```

**LLM:** `Qwen/Qwen2.5-72B-Instruct` via Hugging Face Inference API  
**Parameters:** `max_tokens=700`, `temperature=0.4`

**System Prompt Identity:** *"You are Gwen, the Cleanflow product assistant..."*

---

## 9. API Reference Summary

### Core Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | No | Health ping |
| GET | `/health` | No | DB connectivity check |
| POST | `/upload` | No | Upload CSV/Excel file |
| POST | `/upload-data` | No | Upload JSON data array |
| POST | `/ingest/database` | ✅ | Query from saved DB connection |
| POST | `/validate/{session_id}` | No | Run validation rules |
| GET | `/download/{filename}` | No | Download result file |
| GET | `/dataset/{session_id}/preview` | No | Preview dataset rows |
| GET | `/features/export/{session_id}` | No | Export cleaned data |

### Auth Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account + send OTP |
| POST | `/token` | Login → JWT |
| POST | `/verify-otp` | Verify OTP → JWT |
| POST | `/resend-otp` | Resend OTP email |
| GET | `/users/me` | Get current user profile |

### Feature Endpoints

| Feature | Endpoints |
|---|---|
| **Enrichment** | `GET /features/enrichment/providers` · `POST /features/enrichment/preview/{sid}` · `POST /features/enrichment/execute/{sid}` |
| **Cleaner** | `GET /features/cleaner/operations` · `POST /features/cleaner/preview/{sid}` · `POST /features/cleaner/execute/{sid}` |
| **Mapper** | `GET /features/mapper/transformations` · `GET /features/mapper/aggregations` · `POST /features/mapper/suggest/{sid}` · `POST /features/mapper/preview/{sid}` · `POST /features/mapper/execute/{sid}` |
| **Matching** | `GET /features/matching/algorithms` · `POST /features/matching/load-dataset` · `POST /features/matching/upload-dataset` · `POST /features/matching/ingest-database` · `POST /features/matching/preview/{sid}` · `POST /features/matching/start/{sid}` · `GET /features/matching/status/{sid}` · `GET /features/matching/results/{sid}` · `GET /features/matching/download/{sid}` |
| **Pricing** | `GET /features/pricing/algorithms` · `GET /features/pricing/strategies` · `POST /features/pricing/load-dataset` · `POST /features/pricing/upload-dataset` · Similar run/status/results endpoints |
| **Scraper** | `GET /features/scraper/templates` · `POST /features/scraper/preview` · `POST /features/scraper/execute` |
| **Mapper** | `GET /features/mapper/transformations` etc. |
| **Chatbot** | `POST /api/chat` |

### Pipeline Endpoints (all auth-protected, prefix `/pipeline`)

| Method | Path | Description |
|---|---|---|
| GET | `/pipeline/saved` | List user's pipelines |
| POST | `/pipeline/saved` | Create/update pipeline (upsert) |
| GET | `/pipeline/saved/{id}` | Get single pipeline |
| DELETE | `/pipeline/saved/{id}` | Delete pipeline (cascades) |
| GET | `/pipeline/schedules` | List all user schedules |
| GET | `/pipeline/saved/{id}/schedules` | List schedules for pipeline |
| POST | `/pipeline/saved/{id}/schedules` | Create schedule |
| PATCH | `/pipeline/schedules/{id}/toggle` | Toggle schedule active |
| DELETE | `/pipeline/schedules/{id}` | Delete schedule |
| GET | `/pipeline/runs` | List run history |
| POST | `/pipeline/runs` | Start run record |
| PATCH | `/pipeline/runs/{id}` | Update run (status/logs/output) |
| DELETE | `/pipeline/runs/{id}` | Delete run record |

---

## 10. Session Management

CleanFlow uses an **in-memory Python dictionary** as the session store:

```python
sessions: Dict[str, Any] = {}
# key  = session_id (UUID string)
# value = PolarsValidationEngine | DataMatcher | PricingIntelligence | ...
```

**Lifecycle:**
- Created on file upload / DB ingest
- Persists for the lifetime of the backend process
- **No TTL or eviction** — sessions accumulate until server restart
- Multi-dataset features (Matching, Pricing) use the same session to hold multiple DataFrames keyed by `dataset_id`

> [!WARNING]
> This in-memory session store is **not horizontally scalable** and **not crash-safe**. For production scaling, replace with Redis or a shared cache layer.

---

## 11. Email & Notification System

### 11.1 OTP Emails (Resend API)

File: `backend/email_utils.py`  
- Uses the `resend` Python library  
- Sender: `admin@cleanflow.one`  
- Template: HTML with logo (base64 encoded in `logo_b64.py`)  
- Triggered on: registration, unverified login attempt, resend-otp request

### 11.2 Pipeline Email Notifications (SMTP)

File: `backend/email_utils.py` → `send_pipeline_email()`  
File: `backend/features/pipeline_runner.py` (email node handler)

- Uses Python `smtplib` with `STARTTLS` on port 587  
- Credentials: `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PORT` (env vars)  
- Supports macro token substitution: `{{TODAY_DATE}}`, `{{STATUS}}`, `{{ROW_COUNT}}`, `{{PIPELINE_NAME}}`

---

## 12. Job History & Audit Trail

After any significant operation (validation, cleaning, matching, etc.), the frontend calls:

```
POST /history/jobs
  → Saves ValidationJob record to PostgreSQL
  → Includes: session_id, filename, rules[], row counts, column_stats, module
```

History is viewable in the UI via:
```
GET /history/jobs          → user's job list
DELETE /history/jobs/{id}  → delete single job
DELETE /history/jobs       → clear all (optional module filter)
```

Database connections are managed via:
```
GET    /history/connections      → list user's saved DB connections
POST   /history/connections      → save new connection profile
DELETE /history/connections/{id} → remove connection
```

---

## 13. Frontend Architecture

### 13.1 Directory Structure

```
frontend/src/
├── App.jsx                    # Root component: routing, workspace orchestration (~63KB)
├── main.jsx                   # React DOM entry
├── index.css / App.css        # Global styles
├── features/                  # Feature-specific workspace builders
│   ├── DataMatchingBuilder.jsx
│   ├── DataVisualizer.jsx
│   ├── EnrichmentBuilder.jsx
│   ├── GlobalRepositoryBuilder.jsx
│   ├── PipelineBuilder.jsx    # Largest: ~102KB, React Flow canvas
│   ├── PipelineRuns.jsx
│   ├── PricingIntelligenceBuilder.jsx  # Largest: ~126KB
│   ├── SchedulerBuilder.jsx
│   ├── SchemaMapper.jsx
│   └── ScraperBuilder.jsx
├── components/
│   ├── ChatBot.tsx            # Gwen AI assistant overlay
│   ├── DataConnection.jsx     # DB connection manager
│   ├── DatasetViewer.jsx      # Reusable dataset table preview
│   ├── HistoryPanel.jsx       # Job history sidebar
│   ├── RepoSidebar.jsx        # Global repo browser panel
│   ├── ResultsDashboard.jsx   # Validation results summary
│   ├── RuleBuilder.jsx        # Quality validation rule editor (~46KB)
│   └── WorkspaceTabs.jsx      # Tab navigation for workspace areas
└── pages/
    ├── Home.jsx               # Landing page
    ├── Validation.jsx         # Validation page wrapper
    ├── Pricing.jsx            # Pricing page
    ├── AboutUs.jsx
    └── ...
```

### 13.2 Routing Strategy

All routing is handled in `App.jsx` using conditional rendering / state-based view switching (not React Router). The main workspace is a tabbed interface where each tab renders the appropriate feature builder.

### 13.3 Key Libraries Usage

| Library | Used For |
|---|---|
| `@xyflow/react` | Pipeline Builder drag-and-drop canvas (nodes, edges, handles) |
| `recharts` | All charts in Data Visualizer (Bar, Line, Pie, Area, Scatter) |
| `framer-motion` | Page transition animations, slide-ins, modal open/close |
| `axios` | All API communication (with auth header injection) |
| `lucide-react` | All icons throughout the UI |
| `react-markdown` | Rendering Gwen's Markdown chatbot responses |
| `xlsx` | Client-side Excel file parsing and export |

---

## 14. Data Flow Diagrams

### 14.1 Validation Flow

```
User → Upload CSV → POST /upload
  → PolarsValidationEngine.load_data()
  → pl.read_csv() → sessions[id] = engine
  → Return { session_id, columns }

User → Configure Rules → POST /validate/{session_id}
  → ValidationConfig.rules: ValidationRule[]
  → Build Polars expression tree
  → lf.with_columns(errors, valid_flag).collect()
  → Split: valid_df, error_df
  → Write CSVs to /results/
  → Return { total, valid, invalid, column_stats }

User → Download → GET /download/{filename}
  → FileResponse from /results/ directory
```

### 14.2 Matching Flow

```
User → Load Dataset 1 → POST /features/matching/upload-dataset (dataset_id="primary")
  → sessions[sid] = DataMatcher()
  → matcher.datasets["primary"] = pl.read_csv(file)

User → Load Dataset 2 → POST /features/matching/upload-dataset (dataset_id="secondary")
  → matcher.datasets["secondary"] = pl.read_csv(file)

User → Configure Rules → POST /features/matching/start/{session_id}
  → BackgroundTasks → matcher.execute(config)
      → _perform_matching(df1, df2, config)
        → For each rule:
            → algorithm.batch(series1, series2, threshold)
            → Aggregate candidate_scores[(idx1,idx2)]
        → avg_score per pair
        → Fetch rows → build result dicts
        → Sort by score

Frontend polls → GET /features/matching/status/{session_id}
  → { percent, message, status }

Complete → GET /features/matching/results/{session_id}
  → { ready: true, results: [...100], total_matches }

User → Download → GET /features/matching/download/{session_id}?fmt=csv|excel
```

### 14.3 Pipeline Execution Flow

```
User → Build pipeline on canvas (React Flow)
  → Nodes: [dataset, cleaner, validation, export, email]
  → Save → POST /pipeline/saved

User → Run → POST /pipeline/execute (main.py)
  → PipelineOrchestrator(session_id, initial_df)
  → topological_sort(nodes, edges) → [n1, n2, n3...]
  → For each node:
      dataset  → log loaded rows
      cleaner  → DataCleaner.execute() → mutate current_df
      validation → PolarsValidationEngine.validate()
      export   → write_excel(results/)
      email    → resolve macros → send_pipeline_email()
  → POST /pipeline/runs (create run record)
  → PATCH /pipeline/runs/{id} (update with logs/status)
  → Return { success, logs, preview_data, output_file }
```

---

## 15. Security Considerations

| Area | Current State | Recommended |
|---|---|---|
| **Passwords** | bcrypt hashed (max 72 chars) | ✅ Good |
| **JWT** | HS256, 30 min expiry | Consider RS256 for multi-service |
| **OTP** | 6-digit, 10 min expiry | ✅ Good |
| **DB Passwords** | Stored plaintext in `db_connections` | ⚠️ Encrypt with Fernet or KMS |
| **Custom Expression** | `eval()` with sandboxed builtins | ⚠️ Still a risk — use safer DSL |
| **Session Store** | In-memory dict, no auth check on session_id | ⚠️ Any caller with a session_id can access data |
| **File Paths** | Download endpoint exposes `results/` directory | ⚠️ Add path traversal protection |
| **CORS** | Tight production origins + regex for Vercel | ✅ Good |
| **Rate Limiting** | None | Add for `/token`, `/register`, `/api/chat` |
| **HTTPS** | Enforced by Render/Vercel in production | ✅ Good |

---

*End of CleanFlow Technical Documentation — Last updated: April 2026*
