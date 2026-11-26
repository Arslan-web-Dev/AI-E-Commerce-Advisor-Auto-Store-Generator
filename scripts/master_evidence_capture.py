import asyncio
import os
import sys
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

async def scroll_and_settle(page, wait_seconds=12):
    """
    Smoothly scrolls down the entire page to trigger IntersectionObserver
    on all Reveal / animated elements, then scrolls back to top and waits
    12-15 seconds for complete rendering, 3D canvas, fonts, and data.
    """
    try:
        total_height = await page.evaluate("document.body.scrollHeight")
        step = 350
        for y in range(0, total_height, step):
            await page.evaluate(f"window.scrollTo(0, {y})")
            await page.wait_for_timeout(180)
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(wait_seconds * 1000)
    except Exception as e:
        print(f"    Scroll error: {e}")
        await page.wait_for_timeout(wait_seconds * 1000)

async def run_master_capture():
    print("=" * 65)
    print("AUTONOMOUS MASTER CAPTURE — 2-PASS VERIFICATION & RETAKE")
    print(f"Target URL: {BASE_URL}")
    print(f"Wait Time Per Page: 12 - 15 Seconds")
    print(f"Output Directory: {EVIDENCE_DIR}")
    print("=" * 65)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME_PATH if Path(CHROME_PATH).exists() else None,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--font-render-hinting=none"
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # =========================================================
        # PASS 1: WARM-UP & TESTING ALL PAGES
        # =========================================================
        print("\n>>> PASS 1: Testing and warming up all routes...")

        warmup_routes = [
            "/",
            "/login",
            "/login?mode=signup",
            "/reset-password",
            "/demo-store",
            "/demo-store/catalogue",
            "/demo-store/cart",
            "/demo-store/about",
            "/demo-store/contact"
        ]

        for route in warmup_routes:
            try:
                print(f"  [Warmup] Loading {route}...")
                await page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"  [Warmup Note] {route}: {e}")

        # Authenticate
        print("  [Warmup] Authenticating session...")
        try:
            await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)
            await page.locator('input[type="email"]').fill(USER_EMAIL)
            await page.locator('input[type="password"]').fill(USER_PASSWORD)
            await page.locator('button[type="submit"]').click()
            await page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
            await page.wait_for_timeout(4000)
            print(f"  ✓ Session established! Current URL: {page.url}")
        except Exception as e:
            print(f"  ✗ Auth error: {e}")

        # Authenticated Warmup
        for auth_route in ["/account/security", "/projects", "/market-intelligence", "/wizard", "/admin", "/admin/ml"]:
            try:
                print(f"  [Warmup Auth] Loading {auth_route}...")
                await page.goto(f"{BASE_URL}{auth_route}", wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"  [Warmup Note] {auth_route}: {e}")

        print("\n>>> PASS 1 COMPLETED: All routes tested and cache warmed.\n")

        # =========================================================
        # PASS 2: RETAKING ALL SCREENSHOTS WITH 12-15S SETTLE TIME
        # =========================================================
        print(">>> PASS 2: Retaking all high-resolution screenshots (12-15s settle)...")

        # 1. Landing Page
        print("\n[Capture 1/19] 01-landing-home.png (Landing Page)")
        await page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=45000)
        print("  Waiting 14s for 3D visual scenes and animations to settle...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "01-authentication" / "01-landing-home.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 2. Login Page
        print("\n[Capture 2/19] 02-login-page.png (Login Interface)")
        await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for auth components to settle...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "01-authentication" / "02-login-page.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # Re-authenticate for authenticated views
        print("  Submitting login to refresh authenticated session...")
        await page.locator('input[type="email"]').fill(USER_EMAIL)
        await page.locator('input[type="password"]').fill(USER_PASSWORD)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
        await page.wait_for_timeout(4000)

        # 3. Account Security
        print("\n[Capture 3/19] 03-account-security.png (Account Security & MFA)")
        await page.goto(f"{BASE_URL}/account/security", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 14s for security telemetry and context to settle...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "01-authentication" / "03-account-security.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 4. Sign-up Page
        print("\n[Capture 4/19] 04-signup-page.png (Sign Up View)")
        await page.goto(f"{BASE_URL}/login?mode=signup", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for registration form...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "01-authentication" / "04-signup-page.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 5. Reset Password
        print("\n[Capture 5/19] 05-reset-password.png (Password Reset)")
        await page.goto(f"{BASE_URL}/reset-password", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for reset password interface...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "01-authentication" / "05-reset-password.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 6. Projects Dashboard
        print("\n[Capture 6/19] 01-projects-dashboard.png (Projects Management)")
        await page.goto(f"{BASE_URL}/projects", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 14s for project cards and telemetry...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "02-dashboard" / "01-projects-dashboard.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 7. Market Intelligence
        print("\n[Capture 7/19] 02-market-intelligence.png (Market Intelligence)")
        await page.goto(f"{BASE_URL}/market-intelligence", wait_until="domcontentloaded", timeout=45000)
        print("  Waiting 15s for regional Punjab demand charts and indices...")
        await scroll_and_settle(page, wait_seconds=15)
        target = EVIDENCE_DIR / "02-dashboard" / "02-market-intelligence.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 8. Feasibility Wizard - Step 1
        print("\n[Capture 8/19] 01-wizard-step1-identity.png (Wizard Step 1)")
        await page.goto(f"{BASE_URL}/wizard", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 12s for Step 1 category grid...")
        await scroll_and_settle(page, wait_seconds=12)
        # Type a project name and click Grocery category to show populated state
        try:
            name_input = page.locator('input[placeholder*="title" i], input[placeholder*="name" i], #title').first
            if await name_input.is_visible():
                await name_input.fill("Gulberg Gourmet Grocers")
            grocery_btn = page.locator('button:has-text("Grocery"), div:has-text("Grocery")').first
            if await grocery_btn.is_visible():
                await grocery_btn.click()
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"    Note on wizard interaction: {e}")
        target = EVIDENCE_DIR / "03-business-feasibility" / "01-wizard-step1-identity.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 9. Feasibility Wizard - Step 2
        print("\n[Capture 9/19] 02-wizard-step2-location.png (Wizard Step 2)")
        next_btn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Step 2")').first
        if await next_btn.is_visible():
            await next_btn.click()
        print("  Waiting 12s for Step 2 Punjab location & footprint options...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "03-business-feasibility" / "02-wizard-step2-location.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 10. Feasibility Wizard - Step 3
        print("\n[Capture 10/19] 03-wizard-step3-financials.png (Wizard Step 3)")
        next_btn2 = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Step 3")').first
        if await next_btn2.is_visible():
            await next_btn2.click()
        print("  Waiting 12s for Step 3 financial parameter controls...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "03-business-feasibility" / "03-wizard-step3-financials.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 11. Public Storefront - Home
        print("\n[Capture 11/19] 03-public-storefront-home.png (Storefront Home)")
        await page.goto(f"{BASE_URL}/demo-store", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for storefront products and hero banner...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "05-ecommerce" / "03-public-storefront-home.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 12. Public Storefront - Catalogue
        print("\n[Capture 12/19] 04-public-storefront-catalogue.png (Storefront Catalogue)")
        await page.goto(f"{BASE_URL}/demo-store/catalogue", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for product catalog grid...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "05-ecommerce" / "04-public-storefront-catalogue.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 13. Public Storefront - Cart
        print("\n[Capture 13/19] 05-public-storefront-cart.png (Shopping Cart)")
        await page.goto(f"{BASE_URL}/demo-store/cart", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for shopping cart view...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "05-ecommerce" / "05-public-storefront-cart.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 14. Public Storefront - About
        print("\n[Capture 14/19] 06-public-storefront-about.png (Store About)")
        await page.goto(f"{BASE_URL}/demo-store/about", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for brand story...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "05-ecommerce" / "06-public-storefront-about.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 15. Public Storefront - Contact
        print("\n[Capture 15/19] 07-public-storefront-contact.png (Store Contact)")
        await page.goto(f"{BASE_URL}/demo-store/contact", wait_until="domcontentloaded", timeout=35000)
        print("  Waiting 12s for merchant contact form...")
        await scroll_and_settle(page, wait_seconds=12)
        target = EVIDENCE_DIR / "05-ecommerce" / "07-public-storefront-contact.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 16. Administration Overview
        print("\n[Capture 16/19] 01-admin-overview.png (Admin Console)")
        await page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for system administration telemetry...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "06-administration" / "01-admin-overview.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 17. Administration ML Registry
        print("\n[Capture 17/19] 02-ml-governance-registry.png (ML Registry & Candidate Models)")
        await page.goto(f"{BASE_URL}/admin/ml", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for candidate models table and training logs...")
        await scroll_and_settle(page, wait_seconds=14)
        target = EVIDENCE_DIR / "06-administration" / "02-ml-governance-registry.png"
        await page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        # 18 & 19: Mobile Viewports
        print("\n[Capture 18/19] 01-mobile-viewport-home.png (Mobile 390x844)")
        m_ctx = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        m_page = await m_ctx.new_page()
        await m_page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for mobile landing page...")
        await scroll_and_settle(m_page, wait_seconds=14)
        target = EVIDENCE_DIR / "07-additional-screenshots" / "01-mobile-viewport-home.png"
        await m_page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        print("\n[Capture 19/19] 02-mobile-viewport-wizard.png (Mobile 390x844)")
        await m_page.goto(f"{BASE_URL}/wizard", wait_until="domcontentloaded", timeout=40000)
        print("  Waiting 14s for mobile wizard layout...")
        await scroll_and_settle(m_page, wait_seconds=14)
        target = EVIDENCE_DIR / "07-additional-screenshots" / "02-mobile-viewport-wizard.png"
        await m_page.screenshot(path=target, full_page=True)
        print(f"  ✓ Saved: {target.name} ({target.stat().st_size:,} bytes)")

        await m_ctx.close()
        await context.close()
        await browser.close()

        print("\n" + "=" * 65)
        print("ALL 19 SCREENSHOTS CAPTURED WITH 12-15S SETTLE TIME!")
        print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_master_capture())
