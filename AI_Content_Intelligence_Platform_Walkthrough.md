# AI Content Intelligence Platform
## User Guide and Technical Walkthrough

- **Project Purpose:** Live trend-driven, fact-checked AI content generation and optimization suite utilizing collaborative Gemini agents and Supabase telemetry logging.
- **Technology Stack:** Next.js (App Router), TypeScript, Google Gen AI SDK (Gemini), Supabase (PostgreSQL), Vanilla CSS
- **Date/Version:** June 2026 / Version 1.0.0

---

## Section 1: Overview

The **AI Content Intelligence Platform** solves a critical challenge for modern content creators, marketers, and SEO specialists: **creating high-quality, fact-checked, and search-optimized content efficiently.** 

Many automated writing systems generate generic, unverified articles that fail to rank on search engines or provide genuine value to readers. This platform addresses these shortcomings by employing a collaborative network of specialized AI agents. The agents research topics using real-time search grounding, analyze live Google Trends data, cross-examine claims to prevent hallucination, polish style, and grade drafts against custom quality rubrics.

### Simple Architecture Diagram

```
                 +-----------------------+
                 |      User Input       |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |       AI Agents       |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |     Research Agent    |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |   SEO Analysis Agent  |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |   Content Generation  |
                 +-----------+-----------+
                             |
                             v
                 +-----------+-----------+
                 |   Improved Article    |
                 +-----------------------+
```

---

## Section 2: Application Features

### Feature A: Article Generation

#### Purpose
Enables users to draft comprehensive, high-quality, and fact-checked blog articles or documents from scratch based on a Product Requirement Document (PRD), target audience description, or website/business context.

#### User Steps
1. Navigate to the **Generate Article** page (`/generate`).
2. Input the Product Requirement Document (PRD) or basic guidelines in the input text area.
3. (Optional) Supply SEO recommendations, which are automatically pre-filled if you clicked "Use in Blog Generator" from the SEO page.
4. Click **Start Content Generation Pipeline**.
5. The system redirects to the **Pipeline Generation Lifecycle** page (`/timeline/[runId]`) to watch the live progress and output logs of the Research, Writing, Fact-Checking, Polishing, and Rubric Grading agents.
6. Once complete, review the final polished draft, source citations, and evaluation scores.
7. Click **📄 Export to PDF** to print or download a clean copy.

#### Workflow Diagram
```
  +------------+     +-------------------+     +--------------+     +-------------------+
  | User Input | --> |  Research Agent  | --> | Writer Agent | --> | Generated Article |
  +------------+     | (Search Grounding)|     +--------------+     +-------------------+
                     +-------------------+
```

#### Example Input
* **PRD/Topic:**
  ```markdown
  # Product Requirement Document: Coffee Brewing Guide
  
  ## Target Audience
  Coffee enthusiasts looking to upgrade their home setup.
  
  ## Key Points
  - Introduce the pour-over method.
  - Explain the importance of grind size.
  - Highlight water temperature (between 195°F and 205°F).
  ```

#### Example Output
* **Title:** Mastering the Pour-Over: The Ultimate Home Coffee Brewing Guide
* **Introduction:** For coffee lovers, there is something deeply satisfying about crafting the perfect cup at home. Among the various methods, the pour-over stands out for its clarity of flavor...
* **Sections:**
  - **The Magic of the Pour-Over:** Details the step-by-step pour-over technique.
  - **Why Grind Size is Everything:** Explains the impact of extraction speed.
  - **Water Temperature: The Extraction Sweet Spot:** Emphasizes keeping water between 195°F and 205°F for flavor balance.
* **Conclusion:** Home coffee brewing is a rewarding blend of science and art. By mastering these variables, you can enjoy cafe-quality coffee every day.
* **Citations:** Direct web links to brewing standards.

#### Screenshot Placeholder
[Insert Screenshot: Generate Page]

---

### Feature B: SEO Intelligence

#### Purpose
Analyzes search query trends and search interest metrics for any topic using live Google Search data, recommending high-value target keywords, titles, and structures for new content.

#### User Steps
1. Navigate to the **SEO Intelligence** page (`/seo`).
2. Fill in the **Target Keyword or Topic** (e.g., "Pokemon cards").
3. Fill in the optional **Website or Business Context** (e.g., "TCGNakama marketplace").
4. Click **Analyze SEO Opportunities**.
5. View the Google Search Trends Analysis (related queries, rising topics, trend summary) and the SEO Agent Recommendations (primary/secondary keywords, title ideas, content strategy).
6. Click **🚀 Use in Blog Generator** to prefill the Article Generator form with the target keywords, titles, and SEO strategy guidelines.

#### Example Input
* **Target Keyword/Topic:** `Pokemon cards`
* **Website Context:** `TCGNakama marketplace`

#### Example Output
* **Google Search Trends Summary:** Google Search interest in Pokemon cards remains high, driven by new expansion sets and collector interest. Search traffic peaks around vintage cards, valuation queries, and market trends.
* **Related Queries:** `["Pokemon card values", "how to buy Pokemon cards", "rare Pokemon cards"]`
* **Rising Queries:** `["Pokemon card market trends 2026", "rare Pokemon card prices 2026"]`
* **Primary Keyword:** `Pokemon card investing`
* **Secondary Keywords:** `["rare Pokemon cards", "Pokemon card prices", "Pokemon card market trends"]`
* **Suggested Titles:**
  - `Best Pokemon Cards To Invest In 2026`
  - `How To Identify Valuable Pokemon Cards`
* **SEO Content Strategy:** Write content focusing on card values, identifying rarity markers, and tracking market fluctuations, directly targeting active collectors and hobbyists.

#### Industry Versatility
This system works seamlessly across a broad range of sectors:
- **Trading Cards:** Tracking collector trends and marketplace demand.
- **Restaurants:** Uncovering local culinary trends (e.g., "artisanal sourdough pizza near me").
- **SaaS:** Identifying rising integration demands or feature terms (e.g., "AI scheduling tools").
- **Ecommerce:** Spotting seasonal product queries (e.g., "sustainable winter jackets").

#### Screenshot Placeholder
[Insert Screenshot: SEO Analysis Results]

---

### Feature C: Existing Article Optimizer

#### Purpose
Scores and analyzes an existing article draft against search trend data, highlighting missing keywords, content gaps, and structural formatting improvements.

#### User Steps
1. Navigate to the **Optimize Existing Article** page (`/optimize`).
2. Enter the **Target Keyword** (e.g., "coffee brewing methods").
3. Enter the **Website or Business Context** (e.g., "Local coffee shop").
4. Paste the draft text in the **Existing Article Content** textarea.
5. Click **Analyze & Optimize Article**.
6. Review the **SEO Score** (out of 100), Title Analysis, search intent check, missing keywords, and recommended headings.
7. Click **✨ Improve Article with AI** to automatically feed the draft and recommendation report into the Writer Agent pipeline for a fact-checked rewrite.

#### Workflow Diagram
```
  +------------------+     +--------------+     +-------------------------+     +------------------+
  | Existing Article | --> | SEO Analysis | --> | Improvement Suggestions | --> | Optional Rewrite |
  +------------------+     +--------------+     +-------------------------+     +------------------+
```

#### Example Before & After
* **Before (Weak Content):**
  - **Title:** "Brewing Coffee"
  - **Weakness:** Missing primary search keywords like "v60 technique," weak title, no headers, lacking water temperature specifics.
* **After Optimization Report:**
  - **SEO Score:** `52/100`
  - **Missing Keywords:** `["v60 pour over technique", "home coffee grinder", "water-to-coffee ratio"]`
  - **Content Gaps:** No mention of the ideal water-to-coffee ratio or grind consistency.
  - **Optimized Titles:**
    - `Mastering the V60 Pour Over Technique at Home`
    - `Ultimate V60 Coffee Brewing Guide for Beginners`
  - **Headings Recommended:** `["Choosing the Right Home Coffee Grinder", "The Perfect Water-to-Coffee Ratio"]`

#### Screenshot Placeholder
[Insert Screenshot: Optimization Results]

---

## Section 3: Complete User Workflow Examples

This end-to-end scenario outlines how a company uses the suite to find a keyword opportunity, draft a search-aligned article, and refine it before publishing.

```
       +--------------------------------------------+
       |           1. SEO Intelligence              |
       | Search: "coffee brewing"                   |
       | Select: "v60 technique" recommendations     |
       +---------------------+----------------------+
                             |
                             v
       +---------------------+----------------------+
       |           2. Prefill & Transfer            |
       | Click "Use in Blog Generator" to transfer   |
       | keywords and strategy to generator session |
       +---------------------+----------------------+
                             |
                             v
       +---------------------+----------------------+
       |           3. Generate Article              |
       | Paste PRD. Click generate. Agents research,|
       | write, verify, polish, and grade the post. |
       +---------------------+----------------------+
                             |
                             v
       +---------------------+----------------------+
       |           4. Article Optimizer             |
       | Paste a final draft into the optimizer to  |
       | double-check for missing keyword gaps.     |
       +--------------------------------------------+
```

1. **Step 1: Trend Discovery:** The user opens the **SEO Intelligence** page and searches for "coffee brewing". The system returns a rising query: "v60 pour over technique".
2. **Step 2: Transferring Context:** The user clicks **Use in Blog Generator**. The SEO recommendations (including primary keyword, secondary keywords, and suggested titles) are saved into the local session.
3. **Step 3: Creating Content:** The user lands on the **Generate Article** page, which is prefilled with the SEO context. They paste their product requirements and run the pipeline.
4. **Step 4: Verification and Grading:** The pipeline executes the Research Agent, the Writer Agent drafts the article, the Fact-Checker ensures all claims are verified, the Polisher refines the structure, and the Rubric Grader assigns high marks (e.g., `4.8/5.0`).
5. **Step 5: Review & Export:** The user reviews the completed article and citations, then exports it to PDF.

---

## Section 4: Developer Setup Guide

Follow these steps to run the application locally on your machine.

### Prerequisites
- **Node.js:** Version `20.x` or later (tested on v20.9.0)
- **npm:** Version `10.x` or later (tested on v10.1.0)
- **Accounts & Keys:**
  - Google Gemini API Key
  - Supabase Project Database

### Installation Steps

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd ai-content-agent
   ```

2. **Install Project Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```bash
   touch .env.local
   ```
   Add the following required variables:
   ```env
   # Google Gemini API Access
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Supabase Client Setup
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. **Prepare Database Tables:**
   Execute the SQL script located in `supabase/schema.sql` inside your Supabase SQL editor to create the necessary logging schema:
   ```sql
   -- Create agent_logs table for pipeline telemetry
   CREATE TABLE IF NOT EXISTS agent_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       run_id UUID NOT NULL,
       agent_name VARCHAR(255) NOT NULL,
       input JSONB NOT NULL,
       output JSONB NOT NULL,
       latency_ms INTEGER NOT NULL,
       token_count INTEGER,
       timestamp TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id ON agent_logs(run_id);
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   
6. **Access the Application:**
   Open your browser and navigate to:
   `http://localhost:3000`

---

## Section 5: Project Architecture

The platform uses a decoupled frontend-backend architecture inside Next.js, integrating the Google Gemini API with Supabase database telemetry.

### System Diagram
```
  +--------------------------------------------------------------+
  |                        Frontend Pages                        |
  |      /generate      /seo      /optimize      /timeline       |
  +------------------------------+-------------------------------+
                                 |
                                 v
  +------------------------------+-------------------------------+
  |                          API Routes                          |
  |  /api/generate         /api/seo/trends      /api/seo/optimize|
  +------------------------------+-------------------------------+
                                 |
                                 v
  +------------------------------+-------------------------------+
  |                          AI Agents                           |
  |  research  writer  fact-check  polisher  grader  seo  opt    |
  +-----------------------+--------------+-----------------------+
                          |              |
                          v              v
            +-------------+----+    +----+-------------+
            |  Gemini 3.5 API  |    |  Supabase Logs   |
            | (Search Grounding|    | (agent_logs table|
            +------------------+    +------------------+
```

### Stack Components
- **Frontend Framework:** Next.js 16 (App Router) + TypeScript + React 19.
- **AI Engine:** Google Gen AI API (SDK `@google/genai`).
- **Database Telemetry:** Supabase client logger. All agent interactions, inputs, outputs, token counts, and latencies are stored in the database for tracking run quality.

---

## Section 6: AI Agent Overview

Each agent has a specific job in the content generation and optimization flow.

| Agent Name | Model Used | Input | Output | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Research Agent** | `gemini-3.5-flash` | PRD text | Research summary + verified sources | Performs live web searches to ground facts and collect real-time citations. |
| **Writer Agent** | `gemini-3.5-flash` | PRD + research summary + SEO recommendations | Structured draft (Title, Intro, Sections, Conclusion) | Writes a comprehensive first draft or applies feedback revisions. |
| **Fact-Checker Agent** | `gemini-3.1-pro-preview` | PRD + research + writer draft | Verification status (passed/failed), unsupported claims list, feedback | Cross-checks draft claims against facts, triggering the rollback revision loop if errors are found. |
| **Style Polisher Agent** | `gemini-3.5-flash` | Verified article draft | Polished draft | Refines grammar, tone, readability, and formatting without altering facts. |
| **Rubric Grader Agent** | `gemini-3.1-pro-preview` | PRD + final draft + fact-check results | Rubric scores (Clarity, Accuracy, Completeness), feedback | Provides an objective quality grade (1-5 scale) and qualitative feedback. |
| **SEO Agent** | `gemini-3.5-flash` | Keyword + website context + search trends | Keywords + content ideas + optimized titles | Formulates search strategy, target primary/secondary keywords, and titles. |
| **SEO Optimizer Agent** | `gemini-3.5-flash` | Article draft + keyword + trends | SEO score, keyword/content gaps, headings, suggestions | Benchmarks existing content against search interest data and suggests improvements. |

---

## Section 7: Troubleshooting

### Issue 1: Application Does Not Start
- **Symptom:** Running `npm run dev` fails with error messages.
- **Fix:** 
  1. Verify Node.js version is compatible (`node -v`).
  2. Clear old caches and modules: `rm -rf .next node_modules package-lock.json && npm install`.

### Issue 2: API Key Warnings
- **Symptom:** Terminal shows `Warning: GEMINI_API_KEY environment variable is not set.`
- **Fix:** Double-check that you created `.env.local` exactly in the root directory (not inside `src` or `scripts`), and spelling is correct.

### Issue 3: Supabase Connection Failures
- **Symptom:** Database inserts hang or fail with database errors, agent logs cannot be fetched.
- **Fix:** Check that your Supabase credentials in `.env.local` match your project settings. Verify that you ran the SQL schema in `supabase/schema.sql` to initialize the `agent_logs` table.

### Issue 4: Gemini Requests Fail or Timeout
- **Symptom:** API endpoints return `500 Internal Server Error` during agent generation.
- **Fix:** Ensure you have an active internet connection. Check Gemini API status page to confirm service availability. If rate-limits are reached, space out requests.

---

## Section 8: Future Improvements

The platform has been designed to support easy future expansion:
1. **Google Search Console Integration:** Integrate Google Search Console APIs to fetch real-world search impressions, clicks, and average position data directly into the dashboard.
2. **Competitor SEO Gap Analysis:** Automatically parse competitor web pages (via crawler agents) to outline subtopics that competitors cover but the user's site lacks.
3. **Automated Content Calendars:** Let the SEO agent automatically map out a monthly content calendar based on rising keyword trends and schedule draft generations.
4. **Historical SEO Performance Tracking:** Retain keyword queries and plot their interest score over time in interactive dashboard graphs.
5. **Social Media Hook Generation:** Generate social media copy (e.g., LinkedIn posts, Twitter threads) optimized for promoting generated articles.
