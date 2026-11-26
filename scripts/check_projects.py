import asyncio
from playwright.async_api import async_playwright

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True
        )
        page = await browser.new_page()
        await page.goto("https://ai-e-commerce-advisor-auto-store-ge-plum.vercel.app/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        await page.locator('input[type="email"]').fill("admin@arslan.dev.pk")
        await page.locator('input[type="password"]').fill("root123")
        await page.locator('button[type="submit"]').click()
        await page.wait_for_url(lambda u: "/login" not in u)
        await page.wait_for_timeout(3000)
        
        data = await page.evaluate("""async () => {
            const r = await fetch('/api/projects');
            return await r.json();
        }""")
        print("PROJECTS RESULT:", data)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
