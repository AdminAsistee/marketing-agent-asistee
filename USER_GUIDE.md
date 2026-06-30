# AI Content Generation & SEO Suite User Guide

Welcome to the **AI Content Generation & SEO Suite**! This application is designed to help content creators, marketers, and business owners plan, generate, and optimize search-aligned, fact-checked blog articles and landing page copy.

---

## Overview

This application leverages a collaborative team of specialized **AI agents** working together to automate the entire writing and SEO research workflow:
1. **Research Agent (Gemini Grounding):** Searches the live web to gather verified facts and citations.
2. **SEO Analysis Agent:** Analyzes Google Search interest data and suggests keywords.
3. **Writer Agent:** Writes drafts using custom content guidelines and structural requirements.
4. **Fact-Checker Agent:** Checks the writer's draft against web search results, flags unsupported claims, and requests revisions.
5. **Style Polisher Agent:** Enhances vocabulary and styling for a premium feel.
6. **Rubric Grader Agent:** Scores the content based on clarity, accuracy, and completeness.

---

## Navigation
Use the navigation bar at the top of the screen to quickly jump between the core features:
* **Generate Article:** Draft fact-checked blog articles from a outline or Product Requirement Document (PRD).
* **SEO Intelligence:** Explore search queries and trending topics.
* **Optimize Existing Article:** Analyze and improve an existing draft against trend statistics.

---

## Feature 1: Generate New Article

**Purpose:** Draft a high-quality, fact-checked marketing article from scratch.

### Steps
1. Navigate to **Generate Article** (`/generate`).
2. Enter your Product Requirement Document (PRD) or basic guidelines in the input text area.
3. Click **Start Content Generation Pipeline**.
4. The system will load the **Pipeline Generation Lifecycle** page, showing the live status and progress of the Research, Writing, Fact-Checking, and Grading agents.
5. Review the final article, citations, and evaluation scores on the timeline page.
6. Click **📄 Export to PDF** to print or save a clean, professional copy.

### Example Input
```markdown
# Product Requirement Document: Coffee Brewing Guide

## Target Audience
Coffee enthusiasts looking to upgrade their home setup.

## Key Points
- Introduce the pour-over method.
- Explain the importance of grind size.
- Highlight water temperature (between 195°F and 205°F).
```

### Example Output
A structured article containing:
* **Compelling Title:** "Mastering the Pour-Over: The Ultimate Home Coffee Brewing Guide"
* **Introduction:** Hooking the reader and explaining home brewing popularity.
* **Detailed Sections:** Explicit steps on pour-over, grind sizes, and water temp.
* **Citations:** Embedded web sources backing up claims.

---

## Feature 2: SEO Keyword Intelligence

**Purpose:** Search-optimize your content ideas by retrieving live keyword trends before you write.

### Steps
1. Navigate to **SEO Intelligence** (`/seo`).
2. Fill in the **Target Keyword or Topic** (e.g. "Pokemon cards").
3. Fill in the optional **Website or Business Context** (e.g. "TCGNakama marketplace").
4. Click **Analyze SEO Opportunities**.
5. Review the results:
   * **Google Search Trends Analysis:** The interest summary, related queries, and rising topics showing spikes.
   * **SEO Agent Recommendations:** The target primary keyword, secondary keywords, content ideas, and optimized titles.
6. Click **🚀 Use in Blog Generator** to prefill the main blog generator with the recommendations.

---

## Feature 3: Existing Article Optimizer

**Purpose:** Score an existing article against search trends and improve its structure.

### Steps
1. Navigate to **Optimize Existing Article** (`/optimize`).
2. Enter the **Target Keyword** (e.g. "coffee brewing methods").
3. Enter the **Website or Business Context** (e.g. "Local coffee shop").
4. Paste your current draft into the **Existing Article Content** textarea.
5. Click **Analyze & Optimize Article**.
6. Review the report:
   * **SEO Score:** Rated out of 100.
   * **Title & Intent Analysis:** How well your title fits search intent.
   * **Missing Keywords & Gaps:** Trending keywords to add and topics you missed.
   * **Optimized Titles:** Catchy alternatives.
7. Click **✨ Improve Article with AI** to send the article and report directly to the Writer Agent. It will execute the full fact-checked rewriting pipeline and redirect you to the lifecycle timeline.

---

## Example Complete Workflow

A typical end-to-end user flow:

```
Step 1: Idea Exploration
   Go to "SEO Intelligence" -> Search "coffee brewing" -> Find rising queries like "v60 technique".
          │
          ▼
Step 2: Recommendations
   Get recommendations (Primary: "v60 pour over technique", Title: "V60 Technique: Brew Coffee Like a Barista").
          │
          ▼
Step 3: Transfer Context
   Click "Use in Blog Generator" -> Prefill the PRD specification with the V60 details.
          │
          ▼
Step 4: Generate Article
   Click "Start Content Generation Pipeline" -> Review the final fact-checked draft.
          │
          ▼
Step 5: Post-Publish Review
   Paste a draft in "Article Optimizer" to review readability and missing keywords.
          │
          ▼
Step 6: Iterative Refinement
   Click "Improve Article with AI" -> Export the final perfected PDF.
```

---

## Technical Overview
* **Frontend:** Next.js with React (client-side state, local storage cache) and Tailwind-alternative CSS variables for clean dark-mode visuals.
* **TypeScript:** Strong types for trend data, recommendations, reports, and agents.
* **Generative AI:** Google Gen AI SDK utilizing `gemini-3.5-flash` with Google Search Grounding for live trends and fact checks.
* **Telemetry & Database:** Supabase client tracking run IDs, latency, token count, inputs, and outputs in `agent_logs`.

---

## Future Improvements
* **Google Search Console Integration:** Read actual impression and click data to identify optimization targets automatically.
* **Historical Keyword Interest Charts:** Plot search volume changes over time in interactive graphs.
* **Competitor Gap Analysis:** Automatically parse competitor URLs and highlight missing subtopics.
* **Social Media Intelligence:** Suggest headlines and hooks optimized for Twitter, LinkedIn, or newsletter distribution.
