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
  
  // Fetch 棋诀 with scrolling
  const url = 'https://www.shidianguji.com/book/CADAL08000418/chapter/1l3cs36d690v3';
  console.log('Fetching 棋诀:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click on the "棋诀一卷" link in the sidebar if visible
  try {
    const sidebarLink = await page.$('text=棋诀一卷');
    if (sidebarLink) {
      await sidebarLink.click();
      await page.waitForTimeout(3000);
      console.log('Clicked 棋诀一卷 in sidebar');
    }
  } catch (e) {
    console.log('No sidebar link found');
  }
  
  // Scroll through the reader to load all content
  const scrollStep = 500;
  let totalScrolled = 0;
  let lastContentLen = 0;
  let stableCount = 0;
  
  for (let i = 0; i < 50; i++) {
    await page.evaluate((step) => {
      window.scrollBy(0, step);
    }, scrollStep);
    totalScrolled += scrollStep;
    await page.waitForTimeout(500);
    
    // Check content length
    const contentLen = await page.evaluate(() => {
      const main = document.querySelector('.read-layout-content, .chapter-content, [class*="content"]');
      return main ? main.innerText.length : 0;
    });
    
    if (contentLen === lastContentLen) {
      stableCount++;
      if (stableCount > 5) break;
    } else {
      stableCount = 0;
    }
    lastContentLen = contentLen;
    
    console.log(`  Scroll ${i+1}: total=${totalScrolled}, contentLen=${contentLen}`);
  }
  
  // Now try to extract the content
  const content = await page.evaluate(() => {
    // Look for the reading content area
    const selectors = [
      '.read-layout-content',
      '.chapter-content',
      '.book-content',
      'article',
      '.content-body',
      '.main-content',
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 200) {
        return el.innerText.trim();
      }
    }
    
    // Fallback: find the largest text block that's NOT navigation
    const allDivs = document.querySelectorAll('div, section, article, main');
    let maxLen = 0;
    let maxText = '';
    for (const div of allDivs) {
      const text = div.innerText || '';
      if (text.length > maxLen && text.length > 200) {
        // Skip if it's mostly navigation
        const navKeywords = ['登录', '注册', 'APP', 'All Books', 'Log In'];
        let navCount = 0;
        for (const kw of navKeywords) {
          if (text.includes(kw)) navCount++;
        }
        if (navCount < 3) {
          maxLen = text.length;
          maxText = text;
        }
      }
    }
    return maxText;
  });
  
  console.log('\nExtracted content length:', content.length);
  if (content.length > 100) {
    console.log('First 300:', content.substring(0, 300));
    console.log('Last 300:', content.substring(content.length - 300));
    fs.writeFileSync(path.join('/workspace/projects/public/book-content', '灵棋经_棋诀.txt'), `\n棋诀\n\n${content}`, 'utf-8');
    console.log('Saved 棋诀');
  } else {
    console.log('Content too short, trying page-by-page approach...');
    
    // Alternative: try clicking "Next" buttons to load each page
    let allContent = '';
    for (let pageNum = 0; pageNum < 12; pageNum++) {
      // Try to find and click next button
      try {
        const nextBtn = await page.$('text=Next') || await page.$('[class*="next"]') || await page.$('button:has-text("Next")');
        if (nextBtn && pageNum > 0) {
          await nextBtn.click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {}
      
      // Get current page content
      const pageContent = await page.evaluate(() => {
        const contentArea = document.querySelector('.read-layout-content, .chapter-content, [class*="content"]');
        if (contentArea) {
          // Get only text paragraphs, not navigation
          const paragraphs = contentArea.querySelectorAll('p, .text, [class*="paragraph"]');
          if (paragraphs.length > 0) {
            return Array.from(paragraphs).map(p => p.textContent.trim()).filter(t => t.length > 5).join('\n');
          }
          return contentArea.innerText.trim();
        }
        return '';
      });
      
      console.log(`  Page ${pageNum+1}: ${pageContent.length} chars`);
      if (pageContent.length > 10) {
        allContent += pageContent + '\n\n';
      }
    }
    
    if (allContent.length > 100) {
      fs.writeFileSync(path.join('/workspace/projects/public/book-content', '灵棋经_棋诀.txt'), `\n棋诀\n\n${allContent}`, 'utf-8');
      console.log('Saved 棋诀 with page-by-page approach:', allContent.length, 'chars');
    } else {
      console.log('Failed to get 棋诀 content');
    }
  }
  
  await browser.close();
  console.log('Done!');
})();
