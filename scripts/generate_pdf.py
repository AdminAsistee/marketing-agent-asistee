import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Custom canvas that performs two-pass rendering to dynamically compute
    the total page count and draw running headers and footers on all pages
    except the cover page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        # We don't draw headers/footers on the cover page (Page 1)
        if self._pageNumber == 1:
            return
            
        self.saveState()
        
        # Define brand colors
        teal_primary = colors.HexColor('#0F766E')
        dark_gray = colors.HexColor('#4A5568')
        light_gray = colors.HexColor('#E2E8F0')
        
        # 1. RUNNING HEADER
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(teal_primary)
        self.drawString(54, 750, "THE EDITORIAL ENGINE")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(dark_gray)
        self.drawRightString(558, 750, "User Guide & Technical Walkthrough")
        
        # Header Thin Line
        self.setStrokeColor(light_gray)
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # 2. RUNNING FOOTER
        # Footer Thin Line
        self.line(54, 52, 558, 52)
        
        self.setFont("Helvetica", 8)
        self.setFillColor(dark_gray)
        self.drawString(54, 38, "Confidential — Project Handover Walkthrough")
        
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 38, page_text)
        
        self.restoreState()

def create_pdf(filename="AI_Content_Intelligence_Platform_Walkthrough.pdf"):
    # Target size: letter. Margins: 0.75in (54pt) left/right, 1.0in (72pt) top/bottom
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Define Palette
    primary_color = colors.HexColor('#1A365D') # Slate Blue
    secondary_color = colors.HexColor('#0F766E') # Deep Teal
    text_color = colors.HexColor('#2D3748') # Charcoal
    light_bg = colors.HexColor('#F7FAFC') # Off-White
    border_color = colors.HexColor('#E2E8F0') # Light Grey
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=30,
        leading=38,
        textColor=primary_color,
        alignment=TA_CENTER,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=15,
        leading=20,
        textColor=secondary_color,
        alignment=TA_CENTER,
        spaceAfter=40
    )
    
    cover_meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=16,
        textColor=text_color,
        alignment=TA_CENTER,
        spaceAfter=8
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=primary_color,
        spaceBefore=15,
        spaceAfter=12,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=secondary_color,
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        'SectionH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#2C3E50'),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'WalkthroughBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'WalkthroughBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    code_style = ParagraphStyle(
        'WalkthroughCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#2D3748'),
        spaceAfter=0
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=text_color
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    story = []

    # Helper function for rendering a Code Block (wrapped in a clean 1x1 table)
    def code_block(code_text):
        escaped = code_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>').replace(' ', '&nbsp;')
        p = Paragraph(f"<font name='Courier'>{escaped}</font>", code_style)
        t = Table([[p]], colWidths=[504])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), light_bg),
            ('BOX', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        return t

    # Helper function for Bullet List Items
    def bullet(text):
        return Paragraph(f"&bull;&nbsp;&nbsp;{text}", bullet_style)

    # Helper function for Numbered List Items
    def num_item(num, text):
        return Paragraph(f"{num}.&nbsp;&nbsp;{text}", bullet_style)

    # =========================================================================
    # COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 150))
    story.append(Paragraph("The Editorial Engine", title_style))
    story.append(Paragraph("User Guide and Technical Walkthrough", subtitle_style))
    story.append(Spacer(1, 120))
    
    # Cover Metadata Block (Centered)
    story.append(Paragraph("<b>Project Purpose:</b> Live trend-driven, fact-checked AI content generation & optimization", cover_meta_style))
    story.append(Paragraph("<b>Technology Stack:</b> Next.js (App Router), TypeScript, Gemini, Supabase, Vanilla CSS", cover_meta_style))
    story.append(Paragraph("<b>Date/Version:</b> June 2026 / Version 1.0.0", cover_meta_style))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 1: OVERVIEW
    # =========================================================================
    story.append(Paragraph("Section 1: Overview", h1_style))
    story.append(Paragraph(
        "<b>The Editorial Engine</b> solves a critical challenge for modern content creators, marketers, "
        "and SEO specialists: <b>creating high-quality, fact-checked, and search-optimized content efficiently.</b>",
        body_style
    ))
    story.append(Paragraph(
        "Many automated writing systems generate generic, unverified articles that fail to rank on search engines or "
        "provide genuine value to readers. This platform addresses these shortcomings by employing a collaborative "
        "network of specialized AI agents. The agents research topics using real-time search grounding, analyze "
        "live Google Trends data, cross-examine claims to prevent hallucination, polish style, and grade drafts "
        "against custom quality rubrics.",
        body_style
    ))
    story.append(Spacer(1, 10))
    story.append(Paragraph("High-Level Pipeline Flow", h2_style))
    
    diagram_text = (
        "User Input\n"
        "    │\n"
        "    ▼\n"
        "AI Agents Pipeline\n"
        "    │  ├── Research Agent (Live Web Search)\n"
        "    │  ├── SEO Analysis Agent (Query Analysis)\n"
        "    │  ├── Writer Agent (Drafting & SEO Keywords Integration)\n"
        "    │  └── Fact-Checker Agent (Double-pass Grounding Loop)\n"
        "    v\n"
        "Final Polished & Graded Article\n"
        "    │\n"
        "    ▼\n"
        "Supabase Telemetry Logging (Latency, Tokens, Payload Logs)"
    )
    story.append(code_block(diagram_text))
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 2: APPLICATION FEATURES
    # =========================================================================
    story.append(Paragraph("Section 2: Application Features", h1_style))
    
    # Feature A
    story.append(Paragraph("Feature A: Article Generation", h2_style))
    story.append(Paragraph("<b>Purpose:</b>", h3_style))
    story.append(Paragraph(
        "Enables users to draft comprehensive, high-quality, and fact-checked blog articles or documents from "
        "scratch based on a Product Requirement Document (PRD), target audience description, or website/business context.",
        body_style
    ))
    story.append(Paragraph("<b>User Steps:</b>", h3_style))
    story.append(num_item(1, "Navigate to the <b>Generate Article</b> page (<code>/generate</code>)."))
    story.append(num_item(2, "Input your Product Requirement Document (PRD) or basic guidelines in the input text area."))
    story.append(num_item(3, "(Optional) Pre-fill SEO parameters automatically by using the 'Use in Blog Generator' link from the SEO page."))
    story.append(num_item(4, "Click <b>Start Content Generation Pipeline</b>."))
    story.append(num_item(5, "Watch the live lifecycle progression, retry loops, and agent logs on the timeline dashboard."))
    story.append(num_item(6, "Review the final article, citation sources, and quality grader reports."))
    story.append(num_item(7, "Click the <b>Export to PDF</b> button to save a copy."))
    
    story.append(Paragraph("<b>Workflow:</b>", h3_style))
    workflow_a = (
        "Input PRD ──> Research Agent ──> Writer Agent ──> Fact Checker ──> Grader ──> Final Post\n"
        "                     │                │                │\n"
        "                     │ (Search)       └<── Revision ───┘ (Rollback loop if failed)"
    )
    story.append(code_block(workflow_a))
    story.append(Spacer(1, 5))
    story.append(Paragraph("[Insert Screenshot: Generate Page]", body_style))
    story.append(Spacer(1, 10))

    # Feature B
    story.append(Paragraph("Feature B: SEO Intelligence", h2_style))
    story.append(Paragraph("<b>Purpose:</b>", h3_style))
    story.append(Paragraph(
        "Retrieves real-time Google search trend data for a given topic and uses a dedicated SEO agent to suggest "
        "primary/secondary keywords, blog titles, and content strategies.",
        body_style
    ))
    story.append(Paragraph("<b>User Steps:</b>", h3_style))
    story.append(num_item(1, "Navigate to the <b>SEO Intelligence</b> page (<code>/seo</code>)."))
    story.append(num_item(2, "Enter a <b>Target Keyword/Topic</b> (e.g. 'Pokemon cards') and optional business context."))
    story.append(num_item(3, "Click <b>Analyze SEO Opportunities</b> to trigger real-time Google Search trend retrieval."))
    story.append(num_item(4, "Analyze the generated recommendations, including related/rising queries and optimized titles."))
    story.append(num_item(5, "Click <b>Use in Blog Generator</b> to cache recommendations in local storage and pre-fill the writer form."))
    
    story.append(Paragraph("<b>Example:</b>", h3_style))
    story.append(Paragraph("<b>Input Keyword:</b> <code>Pokemon cards</code>", body_style))
    story.append(Paragraph("<b>Output Trends & Recommendations:</b>", body_style))
    story.append(bullet("<b>Primary Keyword:</b> Pokemon card investing"))
    story.append(bullet("<b>Secondary Keywords:</b> rare Pokemon cards, Pokemon card prices, Pokemon card market trends"))
    story.append(bullet("<b>Suggested Titles:</b> 'Best Pokemon Cards To Invest In 2026', 'How To Identify Valuable Pokemon Cards'"))
    story.append(bullet("<b>Content Strategy:</b> Focus on rarity markers, grading tutorials, and pricing fluctuations."))
    
    story.append(Paragraph("<b>Industry Versatility:</b>", h3_style))
    story.append(Paragraph(
        "This feature works across diverse sectors. For example: <b>Trading Cards</b> (trends on set releases), "
        "<b>Restaurants</b> (local culinary spikes), <b>SaaS</b> (rising integration needs), or "
        "<b>Ecommerce</b> (seasonal shopping queries).",
        body_style
    ))
    story.append(Spacer(1, 5))
    story.append(Paragraph("[Insert Screenshot: SEO Analysis Results]", body_style))
    story.append(PageBreak())

    # Feature C
    story.append(Paragraph("Feature C: Existing Article Optimizer", h2_style))
    story.append(Paragraph("<b>Purpose:</b>", h3_style))
    story.append(Paragraph(
        "Benchmarks an existing draft against current search trends to identify missing keywords, content gaps, "
        "and structural improvements.",
        body_style
    ))
    story.append(Paragraph("<b>User Steps:</b>", h3_style))
    story.append(num_item(1, "Navigate to the <b>Existing Article Optimizer</b> (<code>/optimize</code>)."))
    story.append(num_item(2, "Provide the <b>Target Keyword</b>, <b>Website Context</b>, and paste the draft content."))
    story.append(num_item(3, "Click <b>Analyze & Optimize Article</b>."))
    story.append(num_item(4, "Review the SEO score, title evaluation, content gaps list, and readability feedback."))
    story.append(num_item(5, "Click <b>Improve Article with AI</b> to send the draft and optimizer report to the Writer Agent pipeline for a full rewrite."))
    
    story.append(Paragraph("<b>Example Before/After:</b>", h3_style))
    story.append(Paragraph("<b>Before (Weak Content):</b> Title: 'Brewing Coffee' (No headers, missing keyword terms like 'v60 technique').", body_style))
    story.append(Paragraph("<b>After Report Output:</b>", body_style))
    story.append(bullet("<b>SEO Score:</b> 52/100"))
    story.append(bullet("<b>Missing Keywords:</b> 'v60 pour over technique', 'home coffee grinder', 'water-to-coffee ratio'"))
    story.append(bullet("<b>Recommended Titles:</b> 'Mastering the V60 Pour Over Technique at Home', 'Ultimate V60 Coffee Brewing Guide'"))
    story.append(bullet("<b>Actionable Suggestion:</b> Add a dedicated heading on choosing grind sizes and coffee-to-water ratios."))
    
    story.append(Spacer(1, 5))
    story.append(Paragraph("[Insert Screenshot: Optimization Results]", body_style))
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 3: COMPLETE USER WORKFLOW EXAMPLES
    # =========================================================================
    story.append(Paragraph("Section 3: Complete User Workflow Examples", h1_style))
    story.append(Paragraph(
        "A typical end-to-end user workflow combines all three features to discover keyword opportunities, generate "
        "a fact-checked draft, and audit it for complete search alignment.",
        body_style
    ))
    
    workflow_steps = (
        "+-------------------------------------------------------------------+\n"
        "| Step 1: Idea Exploration (SEO Intelligence)                        |\n"
        "|  - Query: \"coffee brewing\"                                        |\n"
        "|  - Discover: \"v60 pour over technique\" as a rising trend          |\n"
        "+---------------------------------┬---------------------------------+\n"
        "                                  |\n"
        "                                  v\n"
        "+---------------------------------┴---------------------------------+\n"
        "| Step 2: Prefill Context                                           |\n"
        "|  - Click \"Use in Blog Generator\" to carry over SEO suggestions   |\n"
        "+---------------------------------┬---------------------------------+\n"
        "                                  |\n"
        "                                  v\n"
        "+---------------------------------┴---------------------------------+\n"
        "| Step 3: Content Generation (Article Generator)                    |\n"
        "|  - Enter PRD and run pipeline                                     |\n"
        "|  - Pipeline coordinates: Research -> Write -> Fact-Check -> Grade |\n"
        "+---------------------------------┬---------------------------------+\n"
        "                                  |\n"
        "                                  v\n"
        "+---------------------------------┴---------------------------------+\n"
        "| Step 4: Iterative Refinement (Optimizer)                          |\n"
        "|  - Paste draft to confirm all trends are covered                  |\n"
        "|  - Generate polished PDF article draft                            |\n"
        "+-------------------------------------------------------------------+"
    )
    story.append(code_block(workflow_steps))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 4: DEVELOPER SETUP GUIDE
    # =========================================================================
    story.append(Paragraph("Section 4: Developer Setup Guide", h1_style))
    story.append(Paragraph("Follow these instructions to run the application locally on a development machine.", body_style))
    
    story.append(Paragraph("<b>Prerequisites:</b>", h3_style))
    story.append(bullet("Node.js: v20.x or later (v20.9.0 recommended)"))
    story.append(bullet("npm: v10.x or later (v10.1.0 recommended)"))
    story.append(bullet("Active Google Gemini API account"))
    story.append(bullet("Supabase project database"))
    
    story.append(Paragraph("<b>Installation Steps:</b>", h3_style))
    story.append(num_item(1, "Clone the codebase repository: <code>git clone &lt;repository-url&gt;</code>"))
    story.append(num_item(2, "Install npm packages: <code>npm install</code>"))
    story.append(num_item(3, "Create the environment file <code>.env.local</code> in the root directory: <code>touch .env.local</code>"))
    story.append(num_item(4, "Add required keys to <code>.env.local</code> (see variables below)."))
    story.append(num_item(5, "Initialize the Supabase database table using <code>supabase/schema.sql</code>."))
    story.append(num_item(6, "Start the Next.js development server: <code>npm run dev</code>"))
    story.append(num_item(7, "Open browser at: <code>http://localhost:3000</code>"))
    
    story.append(Paragraph("<b>Required Environment Variables (in .env.local):</b>", h3_style))
    env_text = (
        "# Gemini API Access\n"
        "GEMINI_API_KEY=your_gemini_api_key_here\n\n"
        "# Supabase Database Telemetry Credentials\n"
        "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\n"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key\n"
        "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    )
    story.append(code_block(env_text))
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 5: PROJECT ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("Section 5: Project Architecture", h1_style))
    story.append(Paragraph(
        "The project is structured as a standard Next.js 16 application using App Router, with client pages, "
        "serverless API routes, core agent libraries, and database logging via Supabase.",
        body_style
    ))
    
    arch_diagram = (
        "                    [ Next.js Client Pages ]\n"
        "              /generate   /seo   /optimize   /timeline\n"
        "                               │\n"
        "                               ▼\n"
        "                    [ Next.js API Routes ]\n"
        "       /api/generate   /api/seo/trends   /api/seo/optimize\n"
        "                               │\n"
        "                               ▼\n"
        "                    [ Core Agent Libraries ]\n"
        "      researcher.ts  writer.ts  factChecker.ts  rubricGrader.ts\n"
        "         seoAgent.ts  seoOptimizer.ts  stylePolisher.ts\n"
        "                               │\n"
        "                  ┌────────────┴────────────┐\n"
        "                  ▼                         ▼\n"
        "          [ Gemini API ]           [ Supabase Database ]\n"
        "       (Models: 3.5-flash,          (Table: agent_logs)\n"
        "        3.1-pro-preview)"
    )
    story.append(code_block(arch_diagram))
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Tech Stack Details:</b>", h3_style))
    story.append(bullet("<b>Frontend:</b> React components styled with Next.js variables and custom dark-mode theme CSS."))
    story.append(bullet("<b>AI Agents:</b> Unified <code>@google/genai</code> client calling model endpoints dynamically."))
    story.append(bullet("<b>Telemetry:</b> Supabase table tracking execution latency, tokens, inputs, and outputs."))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 6: AI AGENT OVERVIEW
    # =========================================================================
    story.append(Paragraph("Section 6: AI Agent Overview", h1_style))
    story.append(Paragraph("The platform is powered by seven distinct agents, each with a defined role in the pipeline.", body_style))
    
    # Agent Table
    data = [
        [
            Paragraph("<b>Agent Name</b>", table_header_style), 
            Paragraph("<b>Model Used</b>", table_header_style), 
            Paragraph("<b>Input</b>", table_header_style), 
            Paragraph("<b>Output</b>", table_header_style), 
            Paragraph("<b>Purpose</b>", table_header_style)
        ],
        [
            Paragraph("<b>Research Agent</b>", table_cell_style),
            Paragraph("gemini-3.5-flash", table_cell_style),
            Paragraph("PRD text", table_cell_style),
            Paragraph("Research summary + sources", table_cell_style),
            Paragraph("Performs live web searches with grounding to verify facts.", table_cell_style)
        ],
        [
            Paragraph("<b>Writer Agent</b>", table_cell_style),
            Paragraph("gemini-3.5-flash", table_cell_style),
            Paragraph("PRD + research + SEO keywords", table_cell_style),
            Paragraph("Structured article draft JSON", table_cell_style),
            Paragraph("Drafts the initial post or applies iterative feedback revisions.", table_cell_style)
        ],
        [
            Paragraph("<b>Fact-Checker Agent</b>", table_cell_style),
            Paragraph("gemini-3.1-pro-preview", table_cell_style),
            Paragraph("PRD + research + current draft", table_cell_style),
            Paragraph("Passed boolean + unsupported claims list + feedback", table_cell_style),
            Paragraph("Cross-checks draft claims, triggering a revision rollback loop on errors.", table_cell_style)
        ],
        [
            Paragraph("<b>Style Polisher Agent</b>", table_cell_style),
            Paragraph("gemini-3.5-flash", table_cell_style),
            Paragraph("Verified draft", table_cell_style),
            Paragraph("Polished draft JSON", table_cell_style),
            Paragraph("Improves vocabulary, flow, and headings without altering facts.", table_cell_style)
        ],
        [
            Paragraph("<b>Rubric Grader Agent</b>", table_cell_style),
            Paragraph("gemini-3.1-pro-preview", table_cell_style),
            Paragraph("PRD + final draft + fact-check results", table_cell_style),
            Paragraph("Scores (Clarity, Accuracy, Completeness) + text feedback", table_cell_style),
            Paragraph("Computes objective grades (1-5 scale) and qualitative feedback.", table_cell_style)
        ],
        [
            Paragraph("<b>SEO Agent</b>", table_cell_style),
            Paragraph("gemini-3.5-flash", table_cell_style),
            Paragraph("Keyword + context + trends data", table_cell_style),
            Paragraph("Primary/secondary keywords + title options + strategy", table_cell_style),
            Paragraph("Creates search strategy based on real-time trend interests.", table_cell_style)
        ],
        [
            Paragraph("<b>SEO Optimizer Agent</b>", table_cell_style),
            Paragraph("gemini-3.5-flash", table_cell_style),
            Paragraph("Draft + keyword + trends", table_cell_style),
            Paragraph("SEO score + gaps + headings + suggestions", table_cell_style),
            Paragraph("Compares draft text against keyword trends and suggests improvements.", table_cell_style)
        ]
    ]
    
    agent_table = Table(data, colWidths=[80, 85, 95, 95, 149])
    agent_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_bg]),
    ]))
    
    story.append(agent_table)
    story.append(Spacer(1, 15))

    # =========================================================================
    # SECTION 7: TROUBLESHOOTING
    # =========================================================================
    story.append(Paragraph("Section 7: Troubleshooting", h1_style))
    
    story.append(Paragraph("<b>Issue 1: Application fails to boot or compilation errors:</b>", h2_style))
    story.append(Paragraph("<i>Fix:</i> Ensure Node.js version is 20.x or later. Run <code>rm -rf .next node_modules package-lock.json && npm install</code> to refresh modules.", body_style))
    
    story.append(Paragraph("<b>Issue 2: API key warning in logs:</b>", h2_style))
    story.append(Paragraph("<i>Fix:</i> Check that <code>.env.local</code> is placed in the project root directory and the key <code>GEMINI_API_KEY</code> has a valid value.", body_style))
    
    story.append(Paragraph("<b>Issue 3: Supabase connection fails or database queries hang:</b>", h2_style))
    story.append(Paragraph("<i>Fix:</i> Verify public and secret keys in <code>.env.local</code>. Make sure the database schema was created in your project using the <code>supabase/schema.sql</code> script.", body_style))
    
    story.append(Paragraph("<b>Issue 4: Gemini requests fail with a 500 status:</b>", h2_style))
    story.append(Paragraph("<i>Fix:</i> Verify your internet connection. Check the Gemini API status dashboard for general outages. If rate limits are exceeded, introduce pauses between executions.", body_style))
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 8: FUTURE IMPROVEMENTS
    # =========================================================================
    story.append(Paragraph("Section 8: Future Improvements", h1_style))
    story.append(Paragraph(
        "The Editorial Engine is designed with modularity to easily integrate future capabilities:",
        body_style
    ))
    story.append(bullet("<b>Google Search Console Integration:</b> Fetch real impression and click data directly to target and refine content gaps automatically."))
    story.append(bullet("<b>Competitor Monitoring:</b> Build scraper agents to scan competitor pages, identifying keyword gaps and recommending optimization angles."))
    story.append(bullet("<b>Automated Content Calendars:</b> Let the system create monthly content calendars and trigger article drafts on a regular cron schedule."))
    story.append(bullet("<b>Historical SEO Tracking:</b> Save search interest history to plot target keyword trends in interactive dashboard charts."))
    story.append(bullet("<b>Social Media Distribution Hooks:</b> Generate promotional social copy (Twitter, LinkedIn) corresponding to new articles."))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF Walkthrough generated successfully.")

if __name__ == "__main__":
    create_pdf()
