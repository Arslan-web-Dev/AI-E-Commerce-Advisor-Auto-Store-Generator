import asyncio
from playwright.async_api import async_playwright

async def test_login():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True
        )
        page = await browser.new_page()
        page.on("console", lambda msg: print("BROWSER CONSOLE:", msg.text))
        page.on("pageerror", lambda exc: print("PAGE ERROR:", exc))
        async def handle_response(res):
            if "profiles" in res.url:
                try:
                    data = await res.json()
                    print("PROFILE DATA:", data)
                except Exception as e:
                    print("PROFILE ERR:", e)
            elif "auth/v1/token" in res.url:
                print("AUTH TOKEN SUCCESS: status =", res.status)

        page.on("response", handle_response)
        
        print("Navigating to login...")
        await page.goto("https://ai-e-commerce-advisor-auto-store-ge-plum.vercel.app/login", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)
        
        email_loc = page.locator('input[type="email"]')
        pass_loc = page.locator('input[type="password"]')
        submit_btn = page.locator('button[type="submit"]')
        
        print("Email visible:", await email_loc.is_visible())
        print("Password visible:", await pass_loc.is_visible())
        print("Submit visible:", await submit_btn.is_visible())
        
        await email_loc.fill("admin@arslan.dev.pk")
        await pass_loc.fill("root123")
        await submit_btn.click()
        
        try:
            await page.wait_for_url(lambda u: "/login" not in u, timeout=12000)
        except Exception as e:
            print("wait_for_url timed out:", e)

        print("Final URL:", page.url)
        cookies = await page.context.cookies()
        print("Cookies set:", [c["name"] for c in cookies])
        
        # Check alerts
        texts = await page.locator("body").inner_text()
        print("--- PAGE TEXT SUMMARY ---")
        lines = [line.strip() for line in texts.split("\n") if line.strip()]
        for l in lines[:25]:
            print(" ", l)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_login())
