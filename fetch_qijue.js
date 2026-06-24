const { chromium } = require('/workspace/projects/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1161/chrome-linux/chrome',
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  
  const url = 'https://www.shidianguji.com/book/CADAL08000418/chapter/1l3cs36d690v3';
  console.log('Fetching 棋诀:', url);
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Debug: dump all visible text on page
  const bodyText = await page.evaluate(() => {
    // Get all paragraphs and text nodes
    const elements = document.querySelectorAll('p, div.text, div.content, span, article, section');
    const texts = [];
    for (const el of elements) {
      const text = el.textContent.trim();
      if (text.length > 20) {
        texts.push({ tag: el.tagName, class: el.className, text: text.substring(0, 100), len: text.length });
      }
    }
    return texts;
  });
  
  console.log('Found elements with text:');
  for (const t of bodyText.slice(0, 30)) {
    console.log(`  ${t.tag}.${t.class} [${t.len}]: ${t.text}`);
  }
  
  // Get the full text of the main content area
  const mainContent = await page.evaluate(() => {
    // Try to find the reading/content area
    const allDivs = document.querySelectorAll('div');
    let maxLen = 0;
    let maxText = '';
    for (const div of allDivs) {
      const text = div.innerText || '';
      // Skip if it looks like navigation
      if (text.length > maxLen && text.length > 100 && !text.includes('登录') && !text.includes('注册')) {
        maxLen = text.length;
        maxText = text;
      }
    }
    return maxText;
  });
  
  console.log('\nMain content length:', mainContent.length);
  console.log('First 500 chars:', mainContent.substring(0, 500));
  console.log('Last 500 chars:', mainContent.substring(mainContent.length - 500));
  
  if (mainContent.length > 200) {
    fs.writeFileSync(path.join('/workspace/projects/public/book-content', '灵棋经_棋诀.txt'), `\n棋诀\n\n${mainContent}`, 'utf-8');
    console.log('Saved 棋诀');
  }
  
  await browser.close();
  console.log('Done!');
})();
