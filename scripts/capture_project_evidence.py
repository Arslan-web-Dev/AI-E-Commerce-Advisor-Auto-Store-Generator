import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "https://ai-e-commerce-advisor-auto-store-ge-plum.vercel.app")
USER_EMAIL = os.environ.get("USER_EMAIL", "admin@arslan.dev.pk")
USER_PASSWORD = os.environ.get("USER_PASSWORD", "root123")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
EVIDENCE_DIR = Path("project-evidence").resolve()

async def create_and_capture_project():
    print("=== Creating & Capturing In-Depth Project Views ===")

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

        # 1. Login
        print("Logging in...")
        await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        await page.locator('input[type="email"]').fill(USER_EMAIL)
        await page.locator('input[type="password"]').fill(USER_PASSWORD)
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
        await page.wait_for_timeout(3000)
        print("Authenticated successfully.")

        # 2. Create Project via API with session cookies
        print("Creating project via authenticated fetch...")
        project_payload = {
            "title": "Gulberg Gourmet Grocers",
            "category": "Grocery / General Stores",
            "business_scale": "medium",
            "business_model": "hybrid",
            "target_location": "Main Boulevard Gulberg III, Lahore",
            "country": "Pakistan",
            "region": "Punjab",
            "district": "Lahore",
            "city": "Lahore",
            "lat": 31.5204,
            "lng": 74.3587,
            "budget_amount": 2500000,
            "budget_currency": "PKR",
            "storefront_footprint": "commercial",
            "product_description": "Premium organic grocery and daily essentials store catering to urban households in Gulberg Lahore."
        }

        created = await page.evaluate(f"""async () => {{
            const res = await fetch('/api/projects', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({dict(project_payload)})
            }});
            return await res.json();
        }}""")
        print("Created project response:", created)

        project_id = created.get("id") or (created.get("data", {}).get("id") if isinstance(created.get("data"), dict) else None)
        if not project_id:
            # Check /projects page again
            await page.goto(f"{BASE_URL}/projects", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            links = await page.locator('a[href*="/projects/"]').all()
            for l in links:
                h = await l.get_attribute("href")
                if h and "/projects/" in h and "new" not in h:
                    project_id = h.split("/projects/")[-1].split("/")[0]
                    break

        print(f"Target Project ID: {project_id}")

        if project_id:
            # Try to submit project if draft
            print(f"Submitting project {project_id}...")
            submitted = await page.evaluate(f"""async () => {{
                const res = await fetch('/api/projects/{project_id}/submit', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }}
                }});
                return await res.json();
            }}""")
            print("Submit response:", submitted)

            # View 1: Project Details / Feasibility Score
            print(f"Capturing Feasibility for {project_id}...")
            await page.goto(f"{BASE_URL}/projects/{project_id}/feasibility", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "04-feasibility-analysis.png", full_page=True)
            print("  ✓ Saved 04-feasibility-analysis.png")

            # Project Main Detail
            await page.goto(f"{BASE_URL}/projects/{project_id}", wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)
            await page.screenshot(path=EVIDENCE_DIR / "03-business-feasibility" / "05-project-detail-overview.png", full_page=True)
            print("  ✓ Saved 05-project-detail-overview.png")

            # View 2: AI Recommendations & Advisory
            print(f"Capturing AI Advisory for {project_id}...")
            await page.goto(f"{BASE_URL}/projects/{project_id}/advisory", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            await page.screenshot(path=EVIDENCE_DIR / "04-ai-recommendations" / "01-ai-advisory-report.png", full_page=True)
            print("  ✓ Saved 01-ai-advisory-report.png")

            # View 3: E-Commerce Storefront Wizard
            print(f"Capturing Storefront Wizard for {project_id}...")
            await page.goto(f"{BASE_URL}/projects/{project_id}/storefront-wizard", wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)
            await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "01-storefront-generator.png", full_page=True)
            print("  ✓ Saved 01-storefront-generator.png")

            # View 4: Store Management Dashboard
            print(f"Capturing Store Management Dashboard for {project_id}...")
            await page.goto(f"{BASE_URL}/projects/{project_id}/store", wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)
            await page.screenshot(path=EVIDENCE_DIR / "05-ecommerce" / "02-store-management-dashboard.png", full_page=True)
            print("  ✓ Saved 02-store-management-dashboard.png")

            # Update Projects Dashboard screenshot now that project exists
            print("Updating Projects Dashboard screenshot with active project...")
            await page.goto(f"{BASE_URL}/projects", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=EVIDENCE_DIR / "02-dashboard" / "01-projects-dashboard.png", full_page=True)
            print("  ✓ Updated 01-projects-dashboard.png")

        await context.close()
        await browser.close()
        print("Project in-depth views captured successfully!")

if __name__ == "__main__":
    asyncio.run(create_and_capture_project())
