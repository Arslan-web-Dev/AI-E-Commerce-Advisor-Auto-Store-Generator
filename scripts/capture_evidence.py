import asyncio
import os
import re
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "https://ai-e-commerce-advisor-auto-store-ge-plum.vercel.app")
USER_EMAIL = os.environ.get("USER_EMAIL", "admin@arslan.dev.pk")
USER_PASSWORD = os.environ.get("USER_PASSWORD", "root123")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
EVIDENCE_DIR = Path("project-evidence").resolve()

# Ensure directories exist
for sub in [
    "01-authentication",
    "02-dashboard",
    "03-business-feasibility",
    "04-ai-recommendations",
    "05-ecommerce",
    "06-administration",
    "07-additional-screenshots",
    "reports"
]:
    (EVIDENCE_DIR / sub).mkdir(parents=True, exist_ok=True)

async def capture_all():
    print(f"=== Autonomous Application Evidence Collection ===")
    print(f"Target: {BASE_URL}")
    print(f"Output Directory: {EVIDENCE_DIR}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME_PATH if Path(CHROME_PATH).exists() else None,
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # ---------------------------------------------------------
        # MODULE 1: AUTHENTICATION & PUBLIC LANDING
        # ---------------------------------------------------------
        print("\n[Module 1] Capturing Landing Page...")
        try:
            await page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(3500)
            await page.screenshot(path=EVIDENCE_DIR / "01-authentication" / "01-landing-home.png", full_page=True)
            print("  ✓ Saved 01-landing-home.png")
        except Exception as e:
            print(f"  ✗ Error on landing page: {e}")

        print("\n[Module 1] Capturing Login Page & Authenticating...")
        try:
            await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=EVIDENCE_DIR / "01-authentication" / "02-login-page.png", full_page=True)
            print("  ✓ Saved 02-login-page.png")

            email_input = page.locator('input[type="email"]')
            password_input = page.locator('input[type="password"]')
            submit_btn = page.locator('button[type="submit"]')

            await email_input.fill(USER_EMAIL)
            await password_input.fill(USER_PASSWORD)
            await page.wait_for_timeout(500)
            await submit_btn.click()

            # Wait for authenticated transition
            await page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
            print(f"  ✓ Authenticated! Current URL: {page.url}")
            await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"  ✗ Authentication error: {e}")

        # Account Security
        print("\n[Module 1] Capturing Account Security & MFA...")
        try:
            await page.goto(f"{BASE_URL}/account/security", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "01-authentication" / "03-account-security.png", full_page=True)
            print("  ✓ Saved 03-account-security.png")
        except Exception as e:
            print(f"  ✗ Error on account security: {e}")

        # ---------------------------------------------------------
        # MODULE 2: DASHBOARDS
        # ---------------------------------------------------------
        print("\n[Module 2] Capturing Projects Dashboard...")
        project_ids = []
        try:
            await page.goto(f"{BASE_URL}/projects", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "02-dashboard" / "01-projects-dashboard.png", full_page=True)
            print("  ✓ Saved 01-projects-dashboard.png")

            # Discover existing project IDs
            links = await page.locator('a[href*="/projects/"]').all()
            for link in links:
                href = await link.get_attribute("href")
                if href and "/projects/" in href:
                    m = re.search(r'/projects/([a-zA-Z0-9_-]+)', href)
                    if m:
                        pid = m.group(1)
                        if pid not in ["new", ""] and pid not in project_ids:
                            project_ids.append(pid)
            print(f"  Discovered project IDs from dashboard: {project_ids}")
        except Exception as e:
            print(f"  ✗ Error on projects dashboard: {e}")

        print("\n[Module 2] Capturing Market Intelligence...")
        try:
            await page.goto(f"{BASE_URL}/market-intelligence", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3500)
            await page.screenshot(path=EVIDENCE_DIR / "02-dashboard" / "02-market-intelligence.png", full_page=True)
            print("  ✓ Saved 02-market-intelligence.png")
        except Exception as e:
            print(f"  ✗ Error on market intelligence: {e}")

        # ---------------------------------------------------------
        # MODULE 3: BUSINESS FEASIBILITY WIZARD
        # ---------------------------------------------------------
        print("\n[Module 3] Capturing 3-Step Business Feasibility Wizard...")
        created_project_id = None
        try:
            await page.goto(f"{BASE_URL}/wizard", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "01-wizard-step1-identity.png", full_page=True)
            print("  ✓ Saved 01-wizard-step1-identity.png (Step 1: Idea & Category)")

            # Fill title and description if inputs exist
            title_input = page.locator('input[placeholder*="title" i], input[placeholder*="name" i], input[id*="name" i]').first
            if await title_input.is_visible():
                await title_input.fill("Gulberg Organic Mart")

            # Try to select a category if not selected
            category_cards = await page.locator('button:has-text("Grocery"), div:has-text("Grocery")').all()
            if category_cards:
                try:
                    await category_cards[0].click()
                except Exception:
                    pass

            # Advance to Step 2
            next_btn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Step 2")').first
            if await next_btn.is_visible():
                await next_btn.click()
                await page.wait_for_timeout(2500)
                await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "02-wizard-step2-location.png", full_page=True)
                print("  ✓ Saved 02-wizard-step2-location.png (Step 2: Location & Footprint)")

                # Advance to Step 3
                next_btn2 = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Step 3")').first
                if await next_btn2.is_visible():
                    await next_btn2.click()
                    await page.wait_for_timeout(2500)
                    await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "03-wizard-step3-financials.png", full_page=True)
                    print("  ✓ Saved 03-wizard-step3-financials.png (Step 3: Financial & Operational)")

                    # Submit Wizard
                    submit_project_btn = page.locator('button:has-text("Calculate"), button:has-text("Generate"), button:has-text("Submit"), button:has-text("Save Project")').first
                    if await submit_project_btn.is_visible():
                        print("  Submitting wizard to generate feasibility project...")
                        await submit_project_btn.click()
                        await page.wait_for_timeout(6000)
                        
                        curr = page.url
                        print(f"  URL after wizard submit: {curr}")
                        m = re.search(r'/projects/([a-zA-Z0-9_-]+)', curr)
                        if m:
                            created_project_id = m.group(1)
                            if created_project_id not in project_ids:
                                project_ids.insert(0, created_project_id)
                            print(f"  ✓ Successfully created/redirected to project: {created_project_id}")
        except Exception as e:
            print(f"  ✗ Error navigating wizard: {e}")

        # Choose the best target project ID
        target_pid = created_project_id or (project_ids[0] if project_ids else None)
        print(f"\nTarget Project ID for In-Depth Analysis: {target_pid}")

        # ---------------------------------------------------------
        # MODULE 3 (Cont.): FEASIBILITY SCORING & ANALYSIS
        # ---------------------------------------------------------
        if target_pid:
            print(f"\n[Module 3] Capturing Feasibility Results for {target_pid}...")
            try:
                await page.goto(f"{BASE_URL}/projects/{target_pid}/feasibility", wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3500)
                await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "04-feasibility-analysis.png", full_page=True)
                print("  ✓ Saved 04-feasibility-analysis.png")
            except Exception as e:
                print(f"  ✗ Error on feasibility view: {e}")

            # ---------------------------------------------------------
            # MODULE 4: AI RECOMMENDATIONS & STRATEGY ADVISORY
            # ---------------------------------------------------------
            print(f"\n[Module 4] Capturing AI Advisory & Recommendations for {target_pid}...")
            try:
                await page.goto(f"{BASE_URL}/projects/{target_pid}/advisory", wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3500)
                await page.screenshot(path=EVIDENCE_DIR / "04-ai-recommendations" / "01-ai-advisory-report.png", full_page=True)
                print("  ✓ Saved 01-ai-advisory-report.png")
            except Exception as e:
                print(f"  ✗ Error on advisory view: {e}")

            # ---------------------------------------------------------
            # MODULE 5: E-COMMERCE & STOREFRONT GENERATION
            # ---------------------------------------------------------
            print(f"\n[Module 5] Capturing Store Management & Generator for {target_pid}...")
            try:
                await page.goto(f"{BASE_URL}/projects/{target_pid}/storefront-wizard", wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3000)
                await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "01-storefront-generator.png", full_page=True)
                print("  ✓ Saved 01-storefront-generator.png")
            except Exception as e:
                print(f"  ✗ Error on storefront wizard: {e}")

            try:
                await page.goto(f"{BASE_URL}/projects/{target_pid}/store", wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(3000)
                await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "02-store-management-dashboard.png", full_page=True)
                print("  ✓ Saved 02-store-management-dashboard.png")
            except Exception as e:
                print(f"  ✗ Error on store dashboard: {e}")

        # ---------------------------------------------------------
        # MODULE 5 (Cont.): LIVE STOREFRONT
        # ---------------------------------------------------------
        print("\n[Module 5] Capturing Live Storefront...")
        try:
            # Check public store routes
            store_slug = "demo-store"
            await page.goto(f"{BASE_URL}/{store_slug}", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "03-public-storefront-home.png", full_page=True)
            print("  ✓ Saved 03-public-storefront-home.png")

            # Try catalogue
            await page.goto(f"{BASE_URL}/{store_slug}/catalogue", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "04-public-storefront-catalogue.png", full_page=True)
            print("  ✓ Saved 04-public-storefront-catalogue.png")
        except Exception as e:
            print(f"  ✗ Note on storefront: {e}")

        # ---------------------------------------------------------
        # MODULE 6: ADMINISTRATION & ML GOVERNANCE
        # ---------------------------------------------------------
        print("\n[Module 6] Capturing Administration & ML Registry...")
        try:
            await page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "06-administration" / "01-admin-overview.png", full_page=True)
            print("  ✓ Saved 01-admin-overview.png")
        except Exception as e:
            print(f"  ✗ Error on admin overview: {e}")

        try:
            await page.goto(f"{BASE_URL}/admin/ml", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "06-administration" / "02-ml-governance-registry.png", full_page=True)
            print("  ✓ Saved 02-ml-governance-registry.png")
        except Exception as e:
            print(f"  ✗ Error on admin/ml: {e}")

        await context.close()
        await browser.close()
        print("\n=== Evidence Collection Completed Successfully ===")

if __name__ == "__main__":
    asyncio.run(capture_all())
