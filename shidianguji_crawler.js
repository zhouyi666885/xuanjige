/**
 * shidianguji.com (识典古籍) 批量下载器
 * 使用 Playwright 渲染页面并提取内容
 */

const { chromium } = require('/workspace/projects/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/workspace/projects/public/book-content';
const LOG_FILE = '/tmp/shidianguji_crawler.log';
const PROGRESS_FILE = '/tmp/shidianguji_progress.json';

// Key metaphysics categories and their IDs on shidianguji.com
const CATEGORIES = [
  // 子部 - 术数类
  { id: 'subu-shushu', name: '术数' },
  { id: 'subu-yixue', name: '医学' },
  { id: 'subu-bingjia', name: '兵家' },
  { id: 'subu-daojia', name: '道家' },
  { id: 'subu-shennong', name: '农家' },
  // 经部
  { id: 'jingbu-yijing', name: '易经' },
  // 史部
  { id: 'shibu-zhengshi', name: '正史' },
  { id: 'shibu-biannian', name: '编年' },
  { id: 'shibu-zash', name: '杂史' },
  // 集部
  { id: 'jibu-biej', name: '别集' },
  { id: 'jibu-zongji', name: '总集' },
];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { completed: [], failed: [] };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function cleanText(text) {
  if (!text) return '';
  // Remove navigation elements
  text = text.replace(/\d+\/\d+/g, '');
  text = text.replace(/\d+%/g, '');
  text = text.replace(/Word Freq/g, '');
  text = text.replace(/Next/g, '');
  text = text.replace(/End/g, '');
  text = text.replace(/Log In/g, '');
  text = text.replace(/All Books/g, '');
  text = text.replace(/APP/g, '');
  text = text.replace(/Add to Library/g, '');
  text = text.replace(/\d+ Editors?/g, '');
  text = text.replace(/Read anytime.*?APP\./g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

async function fetchBookContent(page, bookCode) {
  // First, get the book's table of contents
  const bookUrl = `https://www.shidianguji.com/book/${bookCode}`;
  await page.goto(bookUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  
  // Extract chapter links from the sidebar
  const chapters = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/chapter/"]');
    const chs = [];
    const seen = new Set();
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const title = link.textContent.trim();
      if (href && !seen.has(href) && title) {
        seen.add(href);
        chs.push({ title, href });
      }
    }
    return chs;
  });
  
  if (chapters.length === 0) {
    return { chapters: [], content: '' };
  }
  
  // Fetch each chapter's content
  let allContent = '';
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chUrl = `https://www.shidianguji.com${ch.href}`;
    
    try {
      await page.goto(chUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      
      // Scroll to load content
      await page.evaluate(() => {
        const content = document.querySelector('.read-layout-content, .chapter-content, [class*="content"]');
        if (content) content.scrollIntoView();
      });
      await page.waitForTimeout(1000);
      
      // Extract content
      const chContent = await page.evaluate(() => {
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
          if (el && el.innerText.trim().length > 50) {
            return el.innerText.trim();
          }
        }
        
        // Fallback
        const allDivs = document.querySelectorAll('div, section, article, main');
        let maxLen = 0;
        let maxText = '';
        for (const div of allDivs) {
          const text = div.innerText || '';
          if (text.length > maxLen && text.length > 100) {
            const navKws = ['登录', '注册', 'APP', 'All Books', 'Log In'];
            let navCount = 0;
            for (const kw of navKws) {
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
      
      if (chContent.length > 30) {
        allContent += `\n【${ch.title}】\n\n${cleanText(chContent)}\n\n`;
      }
      
      if ((i + 1) % 5 === 0) {
        log(`  Chapter ${i + 1}/${chapters.length} for ${bookCode}`);
      }
    } catch (e) {
      log(`  Error on chapter ${ch.title}: ${e.message}`);
    }
  }
  
  return { chapters, content: allContent };
}

async function searchAndDownload(page, keyword, maxBooks = 50) {
  log(`Searching for: ${keyword}`);
  
  // Go to the search page
  const searchUrl = `https://www.shidianguji.com/search?keyword=${encodeURIComponent(keyword)}`;
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  // Extract search results
  const results = await page.evaluate(() => {
    const bookLinks = document.querySelectorAll('a[href*="/book/"]');
    const books = [];
    const seen = new Set();
    
    for (const link of bookLinks) {
      const href = link.getAttribute('href') || '';
      const title = link.textContent.trim();
      const codeMatch = href.match(/\/book\/([A-Z0-9]+)/);
      
      if (codeMatch && !seen.has(codeMatch[1])) {
        seen.add(codeMatch[1]);
        books.push({
          code: codeMatch[1],
          title: title.substring(0, 80),
          href: href,
        });
      }
    }
    return books;
  });
  
  log(`Found ${results.length} books for '${keyword}'`);
  return results.slice(0, maxBooks);
}

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
  
  // Initialize log
  fs.writeFileSync(LOG_FILE, `shidianguji.com crawler started - ${new Date().toISOString()}\n`);
  
  const progress = loadProgress();
  const completedCodes = new Set(progress.completed);
  
  // Search for key metaphysics terms
  const searchTerms = [
    '易经', '周易', '术数', '命理', '八字', '六爻',
    '奇门遁甲', '梅花易数', '紫微斗数', '大六壬',
    '风水', '堪舆', '相术', '面相', '手相',
    '占卜', '卜筮', '太乙', '六壬', '遁甲',
    '星命', '择吉', '历法', '阴阳', '五行',
    '黄帝内经', '伤寒论', '本草', '千金方',
    '道德经', '庄子', '列子', '抱朴子',
    '孙子兵法', '三十六计', '六韬',
    '论语', '孟子', '大学', '中庸',
    '春秋', '左传', '史记', '汉书',
    '诗经', '楚辞', '文选',
    '楞严经', '金刚经', '心经', '法华经',
    '宅经', '葬经', '撼龙经', '疑龙经',
    '渊海子平', '三命通会', '滴天髓', '穷通宝鉴',
    '麻衣相法', '柳庄相法', '神相全编',
    '卜筮正宗', '增删卜易', '火珠林',
    '太乙金镜式', '大六壬金口诀',
  ];
  
  let allBooks = [];
  const seenCodes = new Set();
  
  for (const term of searchTerms) {
    try {
      const results = await searchAndDownload(page, term, 20);
      for (const book of results) {
        if (!seenCodes.has(book.code)) {
          seenCodes.add(book.code);
          allBooks.push(book);
        }
      }
    } catch (e) {
      log(`Error searching '${term}': ${e.message}`);
    }
  }
  
  log(`Total unique books found: ${allBooks.length}`);
  
  // Download each book
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < allBooks.length; i++) {
    const book = allBooks[i];
    const { code, title } = book;
    
    // Check if already exists
    const safeName = title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 80);
    const outputPath = path.join(OUTPUT_DIR, `${safeName}.txt`);
    
    if (completedCodes.has(code) || (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024)) {
      log(`[${i + 1}/${allBooks.length}] ⊙ ${title} (已存在)`);
      skipped++;
      continue;
    }
    
    try {
      log(`[${i + 1}/${allBooks.length}] ↓ ${title} (${code})`);
      const { chapters, content } = await fetchBookContent(page, code);
      
      if (content.length > 100) {
        const header = `《${title}》\n来源：识典古籍 ${code}\n章节数：${chapters.length}\n${'='.repeat(40)}\n\n`;
        fs.writeFileSync(outputPath, header + content, 'utf-8');
        const size = fs.statSync(outputPath).size;
        log(`[${i + 1}/${allBooks.length}] ✓ ${title} (${(size / 1024).toFixed(1)}KB, ${chapters.length}章)`);
        downloaded++;
        progress.completed.push(code);
      } else {
        log(`[${i + 1}/${allBooks.length}] ✗ ${title} (内容太短: ${content.length} chars)`);
        failed++;
        progress.failed.push({ code, title, error: 'content too short' });
      }
    } catch (e) {
      log(`[${i + 1}/${allBooks.length}] ✗ ${title} ERROR: ${e.message}`);
      failed++;
      progress.failed.push({ code, title, error: e.message });
    }
    
    // Save progress every 5 books
    if ((i + 1) % 5 === 0) {
      saveProgress(progress);
    }
  }
  
  saveProgress(progress);
  
  log('\n' + '='.repeat(60));
  log(`下载完成！`);
  log(`  总计: ${allBooks.length}`);
  log(`  新下载: ${downloaded}`);
  log(`  跳过: ${skipped}`);
  log(`  失败: ${failed}`);
  
  await browser.close();
  log('Done!');
})();
