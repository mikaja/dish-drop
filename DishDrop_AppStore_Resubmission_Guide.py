#!/usr/bin/env python3
"""Generate DishDrop App Store Resubmission Guide PDF"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)

OUTPUT_PATH = "/Users/maudeniemann/dish-drop/DishDrop_AppStore_Resubmission_Guide.pdf"

# Colors
DARK_BG = HexColor("#1a1a2e")
ACCENT = HexColor("#1acae7")
HEADING_COLOR = HexColor("#1a1a2e")
BODY_COLOR = HexColor("#333333")
MUTED_COLOR = HexColor("#666666")
CODE_BG = HexColor("#f5f5f5")
TABLE_HEADER_BG = HexColor("#1a1a2e")
TABLE_STRIPE = HexColor("#f0f8ff")
WHITE = HexColor("#ffffff")
RED = HexColor("#ef4444")

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        "DocTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=HEADING_COLOR,
        spaceAfter=6,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=MUTED_COLOR,
        spaceAfter=20,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=HEADING_COLOR,
        spaceBefore=24,
        spaceAfter=10,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=HexColor("#2d2d44"),
        spaceBefore=16,
        spaceAfter=8,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=BODY_COLOR,
        spaceAfter=6,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        "CodeBlock",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Courier",
        textColor=HexColor("#1a1a2e"),
        backColor=CODE_BG,
        leftIndent=12,
        rightIndent=12,
        spaceBefore=4,
        spaceAfter=4,
        leading=13,
    ))
    styles.add(ParagraphStyle(
        "BulletItem",
        parent=styles["Normal"],
        fontSize=10,
        textColor=BODY_COLOR,
        leftIndent=20,
        spaceAfter=4,
        leading=14,
        bulletIndent=8,
    ))
    styles.add(ParagraphStyle(
        "ImportantNote",
        parent=styles["Normal"],
        fontSize=10,
        textColor=RED,
        fontName="Helvetica-Bold",
        spaceAfter=6,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=9,
        textColor=BODY_COLOR,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=9,
        textColor=WHITE,
        fontName="Helvetica-Bold",
        leading=12,
    ))
    styles.add(ParagraphStyle(
        "ReviewNotes",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Courier",
        textColor=HexColor("#1a1a2e"),
        backColor=CODE_BG,
        leftIndent=12,
        rightIndent=12,
        spaceAfter=2,
        leading=12,
    ))

    story = []

    # ── Title ──
    story.append(Spacer(1, 40))
    story.append(Paragraph("DishDrop", styles["DocTitle"]))
    story.append(Paragraph("App Store Resubmission Guide", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Complete step-by-step instructions for deploying code changes and "
        "resubmitting DishDrop to the App Store after the three rejection notices.",
        styles["Body"],
    ))

    # ── Prerequisites ──
    story.append(Paragraph("Prerequisites", styles["H1"]))
    prereqs = [
        "Mac with Xcode installed (latest version)",
        "Apple Developer account with access to App Store Connect",
        "Access to the DishDrop repo at <font face='Courier' size='9'>/Users/maudeniemann/dish-drop/</font>",
        "Access to the Supabase database (for migration + test account)",
        "Node.js 18+ and npm installed",
    ]
    for p in prereqs:
        story.append(Paragraph(f"\u2022  {p}", styles["BulletItem"]))

    # ── Step 1 ──
    story.append(Paragraph("Step 1: Apply Database Migration", styles["H1"]))
    story.append(Paragraph(
        "This adds three things to the database: a <b>Report</b> table (for content flagging), "
        "a <b>BlockedUser</b> table (for user blocking), and a <b>termsAcceptedAt</b> column on the User table.",
        styles["Body"],
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph("cd /Users/maudeniemann/dish-drop/api", styles["CodeBlock"]))
    story.append(Paragraph('npx prisma migrate dev --name "add-moderation-and-terms"', styles["CodeBlock"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Wait for the migration to complete successfully. If it fails, check that your "
        "<font face='Courier' size='9'>DATABASE_URL</font> and <font face='Courier' size='9'>DIRECT_URL</font> "
        "in <font face='Courier' size='9'>/api/.env</font> point to the correct Supabase instance.",
        styles["Body"],
    ))

    # ── Step 2 ──
    story.append(Paragraph("Step 2: Create a Reviewer Test Account", styles["H1"]))
    story.append(Paragraph(
        "Apple's review team needs credentials to test the app. Create an account they can use.",
        styles["Body"],
    ))
    story.append(Paragraph("Option A: Use the API (recommended)", styles["H2"]))
    story.append(Paragraph(
        'curl -X POST https://YOUR_API_URL/api/auth/register \\',
        styles["CodeBlock"],
    ))
    story.append(Paragraph(
        '  -H "Content-Type: application/json" \\',
        styles["CodeBlock"],
    ))
    story.append(Paragraph(
        '  -d \'{"email":"reviewer@dishdrop.app",',
        styles["CodeBlock"],
    ))
    story.append(Paragraph(
        '       "password":"Review2026!",',
        styles["CodeBlock"],
    ))
    story.append(Paragraph(
        '       "username":"applereview",',
        styles["CodeBlock"],
    ))
    story.append(Paragraph(
        '       "name":"Apple Reviewer"}\'',
        styles["CodeBlock"],
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Replace <font face='Courier' size='9'>YOUR_API_URL</font> with your actual deployed API URL.",
        styles["Body"],
    ))
    story.append(Paragraph("Option B: Seed directly in database", styles["H2"]))
    story.append(Paragraph(
        "Insert a user row directly into Supabase. Make sure the password is hashed with "
        "bcrypt (12 rounds). The API in Option A handles this automatically.",
        styles["Body"],
    ))

    # ── Step 3 ──
    story.append(Paragraph("Step 3: Deploy the Backend", styles["H1"]))
    story.append(Paragraph("cd /Users/maudeniemann/dish-drop/api", styles["CodeBlock"]))
    story.append(Paragraph("vercel --prod", styles["CodeBlock"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Verify these new endpoints respond:", styles["Body"]))
    endpoints = [
        "<font face='Courier' size='9'>POST /api/moderation/reports</font> \u2014 Content reporting",
        "<font face='Courier' size='9'>POST /api/users/:id/block</font> \u2014 Block a user",
        "<font face='Courier' size='9'>DELETE /api/users/:id/block</font> \u2014 Unblock a user",
        "<font face='Courier' size='9'>GET /api/users/me/blocked</font> \u2014 List blocked users",
        "<font face='Courier' size='9'>DELETE /api/auth/account</font> \u2014 Delete account",
    ]
    for e in endpoints:
        story.append(Paragraph(f"\u2022  {e}", styles["BulletItem"]))

    # ── Step 4 ──
    story.append(PageBreak())
    story.append(Paragraph("Step 4: Build the iOS App", styles["H1"]))
    story.append(Paragraph("cd /Users/maudeniemann/dish-drop/mobile", styles["CodeBlock"]))
    story.append(Paragraph("npx expo prebuild --platform ios", styles["CodeBlock"]))
    story.append(Paragraph("cd ios", styles["CodeBlock"]))
    story.append(Paragraph("pod install", styles["CodeBlock"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Then open the Xcode workspace:", styles["Body"]))
    story.append(Paragraph("open ios/DishDrop.xcworkspace", styles["CodeBlock"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph("In Xcode:", styles["Body"]))
    steps_xcode = [
        "Select your signing team under <b>Signing &amp; Capabilities</b>",
        'Set the build target to a physical device or "Any iOS Device"',
        "Archive: <b>Product &gt; Archive</b>",
        "Once archived, click <b>Distribute App &gt; App Store Connect &gt; Upload</b>",
    ]
    for i, s in enumerate(steps_xcode, 1):
        story.append(Paragraph(f"{i}.  {s}", styles["BulletItem"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "If the build fails, try: <font face='Courier' size='9'>npx expo prebuild --clean --platform ios</font> "
        "then <font face='Courier' size='9'>cd ios &amp;&amp; pod install</font> again.",
        styles["Body"],
    ))

    # ── Step 5 ──
    story.append(Paragraph("Step 5: Update App Store Connect \u2014 Privacy Labels", styles["H1"]))
    story.append(Paragraph(
        "<b>This fixes Guideline 5.1.2(i).</b> The old labels incorrectly claimed the app tracks users. "
        "No code change is needed \u2014 only update the labels in App Store Connect.",
        styles["Body"],
    ))
    story.append(Spacer(1, 4))
    privacy_steps = [
        'Go to App Store Connect &gt; DishDrop &gt; <b>App Privacy</b>',
        'Set <b>"Does this app track users?"</b> to <b>No</b>',
        'Remove <b>"Product Interaction"</b> from any tracking categories',
        'Under <b>"Data Linked to You"</b>, declare these with purpose <b>"App Functionality"</b>:',
    ]
    for i, s in enumerate(privacy_steps, 1):
        story.append(Paragraph(f"{i}.  {s}", styles["BulletItem"]))

    data_items = [
        "<b>Contact Info</b> \u2014 Email address",
        "<b>Identifiers</b> \u2014 Username",
        "<b>User Content</b> \u2014 Photos, reviews/posts",
        "<b>Location</b> \u2014 Coarse location (when in use only)",
    ]
    for d in data_items:
        story.append(Paragraph(f"     \u2022  {d}", styles["BulletItem"]))
    story.append(Paragraph("5.  Save", styles["BulletItem"]))

    # ── Step 6 ──
    story.append(Paragraph("Step 6: Update App Store Connect \u2014 Review Notes", styles["H1"]))
    story.append(Paragraph(
        "Go to the app version submission page &gt; <b>App Review Information</b> &gt; <b>Notes</b> "
        "and paste the following:",
        styles["Body"],
    ))
    story.append(Spacer(1, 4))

    review_lines = [
        "Test Account:",
        "Email: reviewer@dishdrop.app",
        "Password: Review2026!",
        "",
        "HOW TO SIGN UP:",
        'Launch app > tap "Sign Up" on login screen > fill in',
        "name, username, email, password > check \"I agree to",
        'Terms of Service and Privacy Policy" > tap "Create Account"',
        "",
        "HOW TO LOG IN:",
        'Launch app > enter email and password > tap "Sign In"',
        "",
        "HOW TO LOG OUT:",
        "Profile tab (bottom right) > tap gear icon (top right)",
        '> Settings > tap "Log Out" > confirm',
        "",
        "HOW TO DELETE ACCOUNT:",
        'Profile tab > gear icon > Settings > "Delete Account"',
        "> confirm twice",
        "",
        "UGC MODERATION FEATURES:",
        "1. EULA/Terms: Users must agree to Terms of Service",
        "   during registration before accessing any content.",
        "   Terms include zero-tolerance policy for objectionable",
        "   content.",
        "",
        '2. Report Content: On any post, tap the "..." button >',
        '   "Report Post". Select a reason (Spam, Harassment,',
        "   Hate Speech, Nudity, Violence, Other) > add optional",
        "   description > Submit. On comments, long-press >",
        '   "Report Comment".',
        "",
        '3. Block Users: On any user profile, tap the "..."',
        '   button > "Block User" > confirm. Also available from',
        '   the "..." menu on posts. Blocking removes the user',
        "   from your feed and prevents interaction.",
        "",
        "4. 24-Hour Response: Our moderation team reviews all",
        "   reports within 24 hours, removes offending content,",
        "   and terminates violating accounts.",
        "",
        "PRIVACY:",
        "This app does NOT track users. No third-party analytics,",
        "advertising, or tracking SDKs are used. All data is",
        "first-party for app functionality only.",
    ]
    for line in review_lines:
        story.append(Paragraph(line if line else "&nbsp;", styles["ReviewNotes"]))

    # ── Step 7 ──
    story.append(PageBreak())
    story.append(Paragraph("Step 7: Verify Age Rating", styles["H1"]))
    story.append(Paragraph("In App Store Connect &gt; <b>Age Rating</b>:", styles["Body"]))
    age_steps = [
        'Under "User Generated Content", select <b>Yes</b>',
        "This should set the rating to <b>12+</b> (since moderation is now in place)",
        "Review all other questions and answer accurately",
    ]
    for a in age_steps:
        story.append(Paragraph(f"\u2022  {a}", styles["BulletItem"]))

    # ── Step 8 ──
    story.append(Paragraph("Step 8: Submit for Review", styles["H1"]))
    submit_steps = [
        "Select the new build you uploaded in Step 4",
        "Make sure the privacy labels from Step 5 are saved",
        "Make sure the review notes from Step 6 are saved",
        "Click <b>Submit for Review</b>",
    ]
    for i, s in enumerate(submit_steps, 1):
        story.append(Paragraph(f"{i}.  {s}", styles["BulletItem"]))

    # ── Reference Table ──
    story.append(Paragraph("What Changed in the Code", styles["H1"]))
    story.append(Paragraph(
        "For reference, here is a summary of every code change that was made and which Apple guideline it addresses:",
        styles["Body"],
    ))
    story.append(Spacer(1, 8))

    table_data = [
        [
            Paragraph("Apple Guideline", styles["TableHeader"]),
            Paragraph("What Was Missing", styles["TableHeader"]),
            Paragraph("What Was Added", styles["TableHeader"]),
        ],
        [
            Paragraph("<b>2.1</b> \u2014 Info Needed", styles["TableCell"]),
            Paragraph("Auto-login hid signup/logout from reviewer", styles["TableCell"]),
            Paragraph("Removed auto-login, added auth guard, created Settings screen with logout", styles["TableCell"]),
        ],
        [
            Paragraph("<b>1.2</b> \u2014 UGC Safety", styles["TableCell"]),
            Paragraph("No moderation features at all", styles["TableCell"]),
            Paragraph("EULA checkbox on registration, Terms of Service, Privacy Policy, Report modal, Block user on profiles/posts, backend moderation API", styles["TableCell"]),
        ],
        [
            Paragraph("<b>5.1.2(i)</b> \u2014 Tracking", styles["TableCell"]),
            Paragraph("Privacy label claimed tracking", styles["TableCell"]),
            Paragraph("No code change \u2014 update labels in App Store Connect (Step 5)", styles["TableCell"]),
        ],
        [
            Paragraph("<b>5.1.1(v)</b> \u2014 Deletion", styles["TableCell"]),
            Paragraph("No way to delete account", styles["TableCell"]),
            Paragraph("Delete Account in Settings with double confirmation + backend endpoint", styles["TableCell"]),
        ],
    ]

    col_widths = [1.3 * inch, 2.0 * inch, 3.7 * inch]
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("BACKGROUND", (0, 1), (-1, 1), WHITE),
        ("BACKGROUND", (0, 2), (-1, 2), TABLE_STRIPE),
        ("BACKGROUND", (0, 3), (-1, 3), WHITE),
        ("BACKGROUND", (0, 4), (-1, 4), TABLE_STRIPE),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#dddddd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    # ── Troubleshooting ──
    story.append(Paragraph("Troubleshooting", styles["H1"]))
    troubles = [
        (
            "Build fails in Xcode",
            "Run <font face='Courier' size='9'>npx expo prebuild --clean --platform ios</font> "
            "then <font face='Courier' size='9'>cd ios &amp;&amp; pod install</font> again."
        ),
        (
            "Migration fails",
            "Check your <font face='Courier' size='9'>DATABASE_URL</font> and "
            "<font face='Courier' size='9'>DIRECT_URL</font> in "
            "<font face='Courier' size='9'>/api/.env</font> point to the correct Supabase instance."
        ),
        (
            "App still auto-logs in",
            "Clear the app data on the device or do a fresh install. The old demo token "
            "may be cached in AsyncStorage."
        ),
        (
            "Reviewer can't find moderation features",
            "Double-check the Review Notes in App Store Connect match Step 6 exactly. "
            "The report button is the \"...\" icon on posts and profiles."
        ),
    ]
    for title, desc in troubles:
        story.append(Paragraph(f"<b>{title}:</b> {desc}", styles["Body"]))
        story.append(Spacer(1, 4))

    # ── Files Changed ──
    story.append(Paragraph("Files Changed (Complete List)", styles["H1"]))

    story.append(Paragraph("New files (5):", styles["H2"]))
    new_files = [
        "mobile/app/settings.tsx \u2014 Settings screen with logout + delete account",
        "mobile/app/terms.tsx \u2014 Terms of Service / EULA screen",
        "mobile/app/privacy.tsx \u2014 Privacy Policy screen",
        "mobile/components/ReportModal.tsx \u2014 Reusable report content modal",
        "api/src/routes/moderation.ts \u2014 Report CRUD endpoints",
    ]
    for f in new_files:
        story.append(Paragraph(f"\u2022  <font face='Courier' size='9'>{f.split(' \u2014')[0]}</font> \u2014{f.split('\u2014')[1]}", styles["BulletItem"]))

    story.append(Paragraph("Modified files (11):", styles["H2"]))
    mod_files = [
        ("mobile/contexts/AuthContext.tsx", "Removed demo auto-login"),
        ("mobile/app/_layout.tsx", "Auth guard + 3 new routes"),
        ("mobile/app/(auth)/register.tsx", "EULA checkbox"),
        ("mobile/components/ProfileView.tsx", "Settings gear + block/report for other profiles"),
        ("mobile/app/post/[postId].tsx", "Report/block options on posts and comments"),
        ("mobile/app/post/feed.tsx", "Report/block in feed view"),
        ("mobile/lib/api.ts", "New methods: report, block, unblock, deleteAccount"),
        ("mobile/types/index.ts", "ReportData and BlockedUserEntry types"),
        ("api/prisma/schema.prisma", "Report, BlockedUser models + termsAcceptedAt"),
        ("api/src/routes/auth.ts", "Delete account endpoint + termsAcceptedAt"),
        ("api/src/index.ts", "Registered moderation routes"),
    ]
    for path, desc in mod_files:
        story.append(Paragraph(
            f"\u2022  <font face='Courier' size='9'>{path}</font> \u2014 {desc}",
            styles["BulletItem"],
        ))

    # Build
    doc.build(story)
    print(f"PDF created: {OUTPUT_PATH}")

if __name__ == "__main__":
    build_pdf()
