import { NextRequest, NextResponse } from 'next/server';
import { getBookStats, removeBookFromKnowledgeBase } from '@/lib/fulltext-search';

/**
 * GET /api/knowledge-base
 * 获取知识库所有书籍列表
 * ?search=关键词  - 搜索书名
 * ?page=1&pageSize=50 - 分页
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const stats = getBookStats();
    let books = stats.bookNames;

    // 搜索过滤
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      books = books.filter(name =>
        name.includes(searchQuery) || name.toLowerCase().includes(queryLower)
      );
    }

    // 分页
    const total = books.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pagedBooks = books.slice(start, start + pageSize);

    // 为每本书附加基本信息
    const bookList = pagedBooks.map(name => {
      // 从书名推断分类（简单匹配）
      const category = getBookCategory(name);
      return {
        name,
        category,
      };
    });

    return NextResponse.json({
      books: bookList,
      total,
      totalPages,
      page,
      pageSize,
      totalChars: stats.totalChars,
      bookCount: stats.bookCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `获取知识库失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge-base
 * 从知识库删除书籍
 * body: { bookName: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookName } = body;

    if (!bookName) {
      return NextResponse.json({ error: '缺少书名' }, { status: 400 });
    }

    const removed = removeBookFromKnowledgeBase(bookName);
    if (removed) {
      return NextResponse.json({ success: true, message: `《${bookName}》已从知识库删除` });
    } else {
      return NextResponse.json({ error: `《${bookName}》不在知识库中` }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: `删除失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

// 根据书名推断分类
function getBookCategory(bookName: string): string {
  const categories: [string, string[]][] = [
    ['易学', ['易', '周易', '易经', '卦', '爻', '梅花', '六爻', '奇门', '六壬', '太乙']],
    ['八字', ['八字', '命理', '子平', '三命', '滴天髓', '穷通', '渊海', '造化', '格局', '用神']],
    ['紫微', ['紫微', '斗数', '星盘', '飞星', '四化']],
    ['风水', ['风水', '地理', '堪舆', '宅经', '葬书', '寻龙', '水龙', '阳宅', '阴宅', '玄空', '飞星', '八宅']],
    ['相学', ['面相', '手相', '相法', '神相', '麻衣', '柳庄', '水镜', '冰鉴']],
    ['择日', ['择日', '择吉', '通书', '历法', '黄历', '协纪']],
    ['姓名', ['姓名', '五格', '命名', '取名']],
    ['道教', ['道', '真经', '灵宝', '太上', '黄庭', '参同', '悟真', '阴符', '清静', '内丹']],
    ['佛教', ['佛', '经', '禅', '般若', '法华', '华严', '楞严', '金刚', '心经', '净土', '菩萨']],
    ['儒学', ['论语', '孟子', '大学', '中庸', '礼记', '诗经', '尚书', '春秋', '孝经', '传习']],
    ['中医', ['黄帝内经', '伤寒', '本草', '金匮', '温病', '脉经', '千金', '医学']],
    ['术数', ['术数', '太玄', '皇极', '邵子', '铁板', '河洛', '数理']],
  ];

  for (const [cat, keywords] of categories) {
    if (keywords.some(kw => bookName.includes(kw))) {
      return cat;
    }
  }
  return '其他';
}
