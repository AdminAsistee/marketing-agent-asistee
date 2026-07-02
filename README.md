# AI Content Intelligence Platform

The **AI Content Intelligence Platform** is a production-grade, collaborative multi-agent content generation and search optimization engine. It uses real-time search grounding, automated factuality validation loops, tone styling adjustments, and search trends analysis to create and optimize high-quality content that meets professional journalistic standards.

---

## Deployed Access

Users can access the application through the web interface at:
* **Web UI Dashboard:** `https://content-intelligence.platform.local` *(or your company's custom intranet domain)*
* **API Gateway:** `https://api.content-intelligence.platform.local`

---

## Key Features

1. **AI Article Generation:** Automatically researches topics using Google Search grounding, compiles outlines, writes initial drafts, fact-checks assertions, and scores results against quality rubrics.
2. **SEO Intelligence:** Searches Google Trends and related queries to recommend primary/secondary keywords, optimized titles, and structural content strategies.
3. **Existing Article Optimization:** Benchmarks existing draft text against search volume spikes, surfacing content gaps, missing terms, and readability enhancements.
4. **Content Customization:** Full stylistic controls for voice, tone, target audience, formality, paragraph length, and Markdown formatting constraints.
5. **History Tracking:** Visualizes run state logs, agent-by-agent latencies, token consumption, and outputs in an audit timeline.
6. **API-First Architecture:** Standardized JSON REST endpoints enabling seamless integration into external workflows, CMS platforms, and mobile apps.

---

## API Documentation

All API endpoints expect and return JSON payloads.

### 1. Generate Article
* **Endpoint:** `POST /api/articles/generate`
* **Purpose:** Triggers the multi-agent content generation pipeline asynchronously in the background.
* **Input Payload:**
```json
{
  "topic": "Mastering French Press Coffee",
  "requirements": "Targeting high quality home baristas. Discuss water temp and ratios.",
  "writingConfiguration": {
    "primaryTone": "Conversational",
    "secondaryTone": "Educational",
    "audienceType": "Beginners",
    "formalityLevel": 3,
    "paragraphStyle": "Balanced",
    "allowBullets": true,
    "allowNumberedLists": true,
    "allowTables": true,
    "allowHeadings": true,
    "allowExamples": true,
    "lengthSlider": "Medium"
  },
  "seoContext": {
    "primaryKeyword": "french press ratio",
    "secondaryKeywords": ["pour over coffee recipe", "coffee brewing methods"]
  }
}
```
* **Output Response:**
```json
{
  "runId": "4a71d6f2-bf1c-43df-bc53-f725a3a7891d",
  "status": "Running",
  "article": null,
  "metadata": {
    "topic": "Mastering French Press Coffee",
    "writingConfiguration": { ... }
  }
}
```

---

### 2. Optimize Existing Article
* **Endpoint:** `POST /api/articles/optimize`
* **Purpose:** Evaluates an existing article against search trends and generates an optimized, fact-checked version.
* **Input Payload:**
```json
{
  "article": "Here is my short draft about cold brewing. You mix coffee and water...",
  "seoContext": "cold brew method",
  "writingConfiguration": {
    "primaryTone": "Professional",
    "formalityLevel": 4
  }
}
```
* **Output Response:**
```json
{
  "analysis": "Title matches search terms. Readability is balanced but lacks specific measurements.",
  "recommendations": [
    "Include a step-by-step recipe for concentrate.",
    "Mention the recommended coffee-to-water ratio."
  ],
  "optimizedArticle": {
    "title": "Mastering the Cold Brew Method: Ratios & Step-by-Step Guide",
    "introduction": "Cold brew has become a staple for coffee enthusiasts...",
    "sections": [
      {
        "heading": "The Golden Cold Brew Ratio",
        "content": "To achieve a smooth concentrate, use a 1:8 coffee-to-water ratio..."
      }
    ],
    "conclusion": "With these precise ratios, home cold brewing is simple..."
  }
}
```

---

### 3. SEO Intelligence Analysis
* **Endpoint:** `POST /api/seo/analyze`
* **Purpose:** Retreives trending keywords, search interest growth metrics, and outline recommendations.
* **Input Payload:**
```json
{
  "keyword": "coffee brewing methods",
  "websiteContext": "TCG Barista Boutique Shop",
  "industry": "Ecommerce Food & Beverage"
}
```
* **Output Response:**
```json
{
  "keywords": ["coffee brewing methods", "french press ratio", "cold brew method"],
  "trends": [
    { "ranking": 1, "query": "cold brew method", "searchGrowth": "+55%", "estimatedInterest": "High" }
  ],
  "recommendations": {
    "seoStrategy": "Focus on high-utility recipes targeting the primary keyword...",
    "contentIdeas": ["Step-by-step recipes for French Press", "Comparison table of methods"],
    "recommendedTitles": ["Mastering Coffee Brewing Methods at Home"]
  }
}
```

---

### 4. Fetch History Logs
* **Endpoint:** `GET /api/history`
* **Purpose:** Retrieves the run history of previous generations.
* **Optional Query Parameters:**
  * `feature`: Filter by feature name (`Generate Article`, `Optimize Existing Article`, `SEO Intelligence`).
  * `limit`: Number of records to return.
  * `page`: Page number (starting at 1).
* **Output Response:**
```json
[
  {
    "id": "c1a9c2f6-a3d8-4f12-be22-385d89f81d11",
    "run_id": "4a71d6f2-bf1c-43df-bc53-f725a3a7891d",
    "agent_name": "pipeline_status",
    "input": { "title": "Coffee Brewing", "feature": "Generate Article", ... },
    "output": { "status": "Completed", ... },
    "timestamp": "2026-07-02T10:15:30Z"
  }
]
```

---

## Developer Local Setup

To run this platform locally for development and testing:

### Prerequisites
* Node.js v20+
* A Supabase Database Instance
* Google Gemini API Credentials

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` configuration file in the project root:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-url.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   ```
3. Run the SQL schema in `supabase/schema.sql` on your database instance to initialize the log storage table.
4. Launch the local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the dashboard locally.
