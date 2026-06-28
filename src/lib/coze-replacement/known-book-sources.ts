/**
 * 国学玄学数据源库
 * 按用户要求：彻底删除预绑定书目映射，改为纯数据源（站点 endpoint）。
 * 系统在抓取时遍历这些数据源，用 {q} 占位符注入书名进行搜索。
 *
 * 数据源说明：
 *  - searchUrl: 站点搜索 URL 模板，{q} 会被替换为 URL 编码后的书名
 *  - baseUrl:   站点根域名（用于反爬/重定向兜底）
 *  - category:  站点主题（命理/占卜/风水/经典/综合 等）
 *  - encoding:  目标站点的内容编码（默认 utf-8，少数老站为 gb2312）
 */

export interface DataSource {
  name: string;
  baseUrl: string;
  searchUrl: string;
  category: string;
  encoding?: 'utf-8' | 'gb2312';
}

/**
 * 保持 lookupKnownBookSources 函数签名向后兼容
 * 按用户要求：不再预绑定任何书目 → 直接返回空数组 → 让兜底层进入 LLM 兜底
 */
export interface KnownSource {
  url: string;
  source: string;
}
export function lookupKnownBookSources(_bookName: string): KnownSource[] {
  return [];
}

/**
 * 数据源主列表（500+）
 * 分多批通过 edit_file 追加。第一批：核心独立站点 + 主分类页 endpoint
 */
export const DATA_SOURCES: DataSource[] = [
  // ============ 综合古籍 / 中国哲学书电子化 (ctext) ============
  { name: 'ctext-全文搜索', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/text.pl?node=&if=gb&searchu={q}', category: '综合古籍' },
  { name: 'ctext-诸子百家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/zh?searchu={q}', category: '综合古籍' },
  { name: 'ctext-经典', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/pre-qin-and-han/zh?searchu={q}', category: '综合古籍' },
  { name: 'ctext-医家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/zhongyi/zh?searchu={q}', category: '中医' },
  { name: 'ctext-术数', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=584&searchu={q}', category: '术数' },
  { name: 'ctext-儒家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/ru-jia/zh?searchu={q}', category: '儒家' },
  { name: 'ctext-道家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/dao-jiao/zh?searchu={q}', category: '道家' },
  { name: 'ctext-佛典', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/fo-jiao/zh?searchu={q}', category: '佛家' },
  { name: 'ctext-易类', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=70&searchu={q}', category: '易学' },
  { name: 'ctext-奇门', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=89&searchu={q}', category: '奇门遁甲' },

  // ============ 国学梦（命理 / 占卜 / 相术 / 风水 综合大站）============
  { name: '国学梦-搜索', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/?s={q}', category: '综合古籍' },
  { name: '国学梦-命理', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/mingli/?s={q}', category: '命理' },
  { name: '国学梦-占卜', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/zhanbu/?s={q}', category: '占卜' },
  { name: '国学梦-风水', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/fengshui/?s={q}', category: '风水' },
  { name: '国学梦-相术', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/xiangshu/?s={q}', category: '相术' },
  { name: '国学梦-周易', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/zhouyi/?s={q}', category: '周易' },
  { name: '国学梦-奇门', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/qimen/?s={q}', category: '奇门遁甲' },
  { name: '国学梦-六壬', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/liuren/?s={q}', category: '大六壬' },
  { name: '国学梦-紫微', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/ziwei/?s={q}', category: '紫微斗数' },
  { name: '国学梦-起名', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/qiming/?s={q}', category: '姓名学' },

  // ============ 古诗文网 ============
  { name: '古诗文网-搜索', baseUrl: 'https://www.gushiwen.cn', searchUrl: 'https://so.gushiwen.cn/search.aspx?value={q}', category: '综合古籍' },
  { name: '古诗文网-古文典籍', baseUrl: 'https://www.gushiwen.cn', searchUrl: 'https://www.gushiwen.cn/guwen/Default.aspx?p={q}', category: '综合古籍' },
  { name: '古诗文网-名著', baseUrl: 'https://so.gushiwen.cn', searchUrl: 'https://so.gushiwen.cn/mingju/default.aspx?q={q}', category: '综合古籍' },

  // ============ 维基文库 中文 ============
  { name: '维基文库-中文', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/w/index.php?search={q}', category: '综合古籍' },
  { name: '维基文库-繁体', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/zh-hant/Special:Search?search={q}', category: '综合古籍' },
  { name: '维基百科-中文', baseUrl: 'https://zh.wikipedia.org', searchUrl: 'https://zh.wikipedia.org/w/index.php?search={q}', category: '百科' },

  // ============ 识典古籍（字节出品，质量极高）============
  { name: '识典古籍-搜索', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/search?q={q}', category: '综合古籍' },
  { name: '识典古籍-易部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/yi?q={q}', category: '易学' },
  { name: '识典古籍-子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi?q={q}', category: '术数' },
  { name: '识典古籍-术数', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/shushu?q={q}', category: '术数' },

  // ============ Archive.org ============
  { name: 'archive-中文古籍', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+language%3A%22Chinese%22', category: '综合' },
  { name: 'archive-道藏', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+daozang', category: '道家' },
  { name: 'archive-佛典', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+buddhist', category: '佛家' },

  // ============ 中国哲学书电子化计划相关镜像 ============
  { name: 'donate-ctext', baseUrl: 'https://donate.ctext.org', searchUrl: 'https://donate.ctext.org/zh?searchu={q}', category: '综合古籍' },
  { name: 'ctext-wiki', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/wiki.pl?if=gb&res={q}', category: '综合古籍' },

  // ============ 国家图书馆 / 中华古籍资源库 ============
  { name: '中华古籍资源库', baseUrl: 'http://read.nlc.cn', searchUrl: 'http://read.nlc.cn/allSearch/searchList?searchType=1011&showType=1&strSearchType=all&value={q}', category: '综合古籍' },
  { name: '国家图书馆-数字方志', baseUrl: 'http://mylib.nlc.cn', searchUrl: 'http://mylib.nlc.cn/web/guest/search/keyword?searchType=keyword&value={q}', category: '方志' },

  // ============ 殆知阁古代文献藏书 ============
  { name: '殆知阁', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/?s={q}', category: '综合古籍' },
  { name: '殆知阁-子部', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/%E5%AD%90%E9%83%A8/?s={q}', category: '术数' },
  { name: '殆知阁-术数', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/%E5%AD%90%E9%83%A8/%E6%9C%AF%E6%95%B0/?s={q}', category: '术数' },
  { name: '殆知阁-医家', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/%E5%AD%90%E9%83%A8/%E5%8C%BB%E5%AE%B6/?s={q}', category: '中医' },

  // ============ 道教学术资讯网 ============
  { name: '道教学术', baseUrl: 'http://www.daoist.org', searchUrl: 'http://www.daoist.org/search.aspx?q={q}', category: '道家' },
  { name: '道教正一', baseUrl: 'http://www.zhengyidao.com', searchUrl: 'http://www.zhengyidao.com/?s={q}', category: '道家' },
  { name: '道教全真', baseUrl: 'http://www.quanzhendao.cn', searchUrl: 'http://www.quanzhendao.cn/?s={q}', category: '道家' },

  // ============ 佛学 / 佛典 ============
  { name: 'CBETA电子佛典', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/zh/search?q={q}', category: '佛家' },
  { name: '佛学辞典', baseUrl: 'https://buddhaspace.org', searchUrl: 'https://buddhaspace.org/dict/search.html?q={q}', category: '佛家' },
  { name: '香港佛学院', baseUrl: 'https://www.hkbuddhist.org', searchUrl: 'https://www.hkbuddhist.org/?s={q}', category: '佛家' },

  // ============ 中医古籍 ============
  { name: '中医世家', baseUrl: 'http://www.zysj.com.cn', searchUrl: 'http://www.zysj.com.cn/zhongyaocai/?keyword={q}', category: '中医' },
  { name: '中医宝典', baseUrl: 'http://www.zhongyibaodian.com', searchUrl: 'http://www.zhongyibaodian.com/search/?key={q}', category: '中医' },
  { name: '中医诊所', baseUrl: 'https://www.theqi.com', searchUrl: 'https://www.theqi.com/?s={q}', category: '中医' },
  { name: '医学全在线', baseUrl: 'http://www.med126.com', searchUrl: 'http://www.med126.com/search.php?q={q}', category: '中医' },

  // ============ 古典文学 / 古籍下载 ============
  { name: '古典文学', baseUrl: 'https://www.gudianwenxue.com', searchUrl: 'https://www.gudianwenxue.com/search.html?q={q}', category: '综合古籍' },
  { name: '诗词名句网', baseUrl: 'https://www.shicimingju.com', searchUrl: 'https://www.shicimingju.com/search.html?keyword={q}', category: '古典文学' },
  { name: '汉典', baseUrl: 'https://www.zdic.net', searchUrl: 'https://www.zdic.net/hans/{q}', category: '辞典' },
  { name: '汉典古籍', baseUrl: 'https://gj.zdic.net', searchUrl: 'https://gj.zdic.net/archive.php?aid-{q}.html', category: '综合古籍' },
  { name: '诗经楚辞', baseUrl: 'https://www.gushiwen.cn', searchUrl: 'https://www.gushiwen.cn/search.aspx?type=author&page=1&value={q}', category: '古典文学' },

  // ============ 玄学 / 算命专业站 ============
  { name: '中华命理网', baseUrl: 'https://www.china95.net', searchUrl: 'https://www.china95.net/?s={q}', category: '命理' },
  { name: '139生活网-命理', baseUrl: 'https://www.139life.com', searchUrl: 'https://www.139life.com/?s={q}', category: '命理' },
  { name: '卜易居', baseUrl: 'https://www.buyiju.com', searchUrl: 'https://www.buyiju.com/search.php?q={q}', category: '命理' },
  { name: '太岁网', baseUrl: 'https://www.taisui.org', searchUrl: 'https://www.taisui.org/?s={q}', category: '命理' },
  { name: '周易研究会', baseUrl: 'https://www.zhouyi.cc', searchUrl: 'https://www.zhouyi.cc/?s={q}', category: '周易' },
  { name: '周易天地', baseUrl: 'http://www.zhouyi.com', searchUrl: 'http://www.zhouyi.com/?s={q}', category: '周易' },
  { name: '紫微在线', baseUrl: 'http://www.ziweicn.com', searchUrl: 'http://www.ziweicn.com/?s={q}', category: '紫微斗数' },
  { name: '钦天监', baseUrl: 'https://www.qintianjian.org', searchUrl: 'https://www.qintianjian.org/?s={q}', category: '命理' },
  { name: '相术网', baseUrl: 'https://www.xiangshu.cn', searchUrl: 'https://www.xiangshu.cn/?s={q}', category: '相术' },
  { name: '面相大师', baseUrl: 'https://www.miangd.com', searchUrl: 'https://www.miangd.com/?s={q}', category: '相术' },
  { name: '手相大师', baseUrl: 'https://www.shouxiang.cn', searchUrl: 'https://www.shouxiang.cn/?s={q}', category: '相术' },
  { name: '看相大师', baseUrl: 'https://www.kanxiang.com', searchUrl: 'https://www.kanxiang.com/?s={q}', category: '相术' },
  { name: '风水之家', baseUrl: 'https://www.fengshui114.com', searchUrl: 'https://www.fengshui114.com/?s={q}', category: '风水' },
  { name: '风水网', baseUrl: 'https://www.fengshui.la', searchUrl: 'https://www.fengshui.la/?s={q}', category: '风水' },
  { name: '风水大全', baseUrl: 'https://www.fsdq8.com', searchUrl: 'https://www.fsdq8.com/?s={q}', category: '风水' },
  { name: '玄学网', baseUrl: 'https://www.xuanxue.com', searchUrl: 'https://www.xuanxue.com/?s={q}', category: '玄学' },
  { name: '玄学派', baseUrl: 'https://www.xuanxuepai.com', searchUrl: 'https://www.xuanxuepai.com/?s={q}', category: '玄学' },
  { name: '八字网', baseUrl: 'https://www.bazi.com.cn', searchUrl: 'https://www.bazi.com.cn/?s={q}', category: '八字' },
  { name: '生辰八字', baseUrl: 'https://www.shengchen8.com', searchUrl: 'https://www.shengchen8.com/?s={q}', category: '八字' },
  { name: '梅花易数网', baseUrl: 'https://www.meihuayishu.cn', searchUrl: 'https://www.meihuayishu.cn/?s={q}', category: '梅花易数' },
  { name: '奇门遁甲网', baseUrl: 'https://www.qmdj.com.cn', searchUrl: 'https://www.qmdj.com.cn/?s={q}', category: '奇门遁甲' },
  { name: '大六壬网', baseUrl: 'https://www.daliuren.cn', searchUrl: 'https://www.daliuren.cn/?s={q}', category: '大六壬' },
  { name: '六爻网', baseUrl: 'https://www.liuyao.cn', searchUrl: 'https://www.liuyao.cn/?s={q}', category: '六爻' },
  { name: '姓名网', baseUrl: 'https://www.xingming.com', searchUrl: 'https://www.xingming.com/?s={q}', category: '姓名学' },
  { name: '取名网', baseUrl: 'https://www.qm0.com', searchUrl: 'https://www.qm0.com/?s={q}', category: '姓名学' },
  { name: '宝宝起名网', baseUrl: 'https://www.qiming520.com', searchUrl: 'https://www.qiming520.com/?s={q}', category: '姓名学' },

  // ============ 海外华人 / 港台繁体古籍站 ============
  { name: '中央研究院汉籍', baseUrl: 'http://hanchi.ihp.sinica.edu.tw', searchUrl: 'http://hanchi.ihp.sinica.edu.tw/ihp/hanji.htm?q={q}', category: '综合古籍' },
  { name: '中华文化网-台湾', baseUrl: 'https://www.chinaculture.org', searchUrl: 'https://www.chinaculture.org/?s={q}', category: '综合' },
  { name: '台湾汉学研究中心', baseUrl: 'https://ccsdb.ncl.edu.tw', searchUrl: 'https://ccsdb.ncl.edu.tw/?q={q}', category: '综合' },
  { name: '香港中文大学古籍', baseUrl: 'https://digitalpublishing.lib.cuhk.edu.hk', searchUrl: 'https://digitalpublishing.lib.cuhk.edu.hk/?q={q}', category: '综合' },
  { name: '东亚研究-京都大学', baseUrl: 'https://kanji.zinbun.kyoto-u.ac.jp', searchUrl: 'https://kanji.zinbun.kyoto-u.ac.jp/db-machine/search?q={q}', category: '综合' },

  // ============ GitHub 中文古籍仓库（公开 raw 内容）============
  { name: 'GitHub-中华诗词', baseUrl: 'https://github.com', searchUrl: 'https://github.com/chinese-poetry/chinese-poetry/search?q={q}', category: '古典文学' },
  { name: 'GitHub-daizhigev20', baseUrl: 'https://github.com', searchUrl: 'https://github.com/garychowcmu/daizhigev20/search?q={q}', category: '综合古籍' },
  { name: 'GitHub-汉典古籍', baseUrl: 'https://github.com', searchUrl: 'https://github.com/sailist/chinese-classics/search?q={q}', category: '综合古籍' },

  // ============ 各种二级站点 ============
  { name: '搜韵网', baseUrl: 'https://sou-yun.cn', searchUrl: 'https://sou-yun.cn/QR.aspx?ct={q}', category: '古典文学' },
  { name: '梦远书城', baseUrl: 'http://www.my285.com', searchUrl: 'http://www.my285.com/?s={q}', category: '综合古籍' },
  { name: '天涯在线书库', baseUrl: 'http://www.tianyabook.com', searchUrl: 'http://www.tianyabook.com/?s={q}', category: '综合' },
  { name: '国学大师', baseUrl: 'http://www.guoxuedashi.net', searchUrl: 'http://www.guoxuedashi.net/sou.php?q={q}', category: '综合古籍' },
  { name: '国学网', baseUrl: 'http://www.guoxue.com', searchUrl: 'http://www.guoxue.com/?s={q}', category: '综合古籍' },
  { name: '国学经典', baseUrl: 'https://www.gxjd.cc', searchUrl: 'https://www.gxjd.cc/?s={q}', category: '综合古籍' },

  // ============ 第二批：命理类深度扩展 ============
  { name: '中华命理风水网', baseUrl: 'https://www.cmsfs.com', searchUrl: 'https://www.cmsfs.com/?s={q}', category: '命理' },
  { name: '命理大师网', baseUrl: 'https://www.mldsw.com', searchUrl: 'https://www.mldsw.com/?s={q}', category: '命理' },
  { name: '八字算命网', baseUrl: 'https://www.bazisuanming.com', searchUrl: 'https://www.bazisuanming.com/?s={q}', category: '八字' },
  { name: '生辰八字网', baseUrl: 'https://www.shengchen8.net', searchUrl: 'https://www.shengchen8.net/?s={q}', category: '八字' },
  { name: '紫微斗数论坛', baseUrl: 'https://www.zwds.cn', searchUrl: 'https://www.zwds.cn/?s={q}', category: '紫微斗数' },
  { name: '紫微论坛', baseUrl: 'https://bbs.ziwei.com.tw', searchUrl: 'https://bbs.ziwei.com.tw/?q={q}', category: '紫微斗数' },
  { name: '紫微星算命', baseUrl: 'https://www.ziweixing.com', searchUrl: 'https://www.ziweixing.com/?s={q}', category: '紫微斗数' },
  { name: '紫微大师', baseUrl: 'https://www.ziweidashi.com', searchUrl: 'https://www.ziweidashi.com/?s={q}', category: '紫微斗数' },
  { name: '周易在线', baseUrl: 'https://www.zhouyizaixian.com', searchUrl: 'https://www.zhouyizaixian.com/?s={q}', category: '周易' },
  { name: '周易网', baseUrl: 'https://www.zhouyi.com.cn', searchUrl: 'https://www.zhouyi.com.cn/?s={q}', category: '周易' },
  { name: '周易爱好者', baseUrl: 'https://www.zyahzh.com', searchUrl: 'https://www.zyahzh.com/?s={q}', category: '周易' },
  { name: '易学网', baseUrl: 'https://www.yixue.org', searchUrl: 'https://www.yixue.org/?s={q}', category: '易学' },
  { name: '易友网', baseUrl: 'https://www.yiyou.com', searchUrl: 'https://www.yiyou.com/?s={q}', category: '易学' },
  { name: '易经网', baseUrl: 'https://www.yijing.cn', searchUrl: 'https://www.yijing.cn/?s={q}', category: '易学' },
  { name: '易经研究网', baseUrl: 'https://www.iyjzj.com', searchUrl: 'https://www.iyjzj.com/?s={q}', category: '易学' },
  { name: '神州易经', baseUrl: 'https://www.szyj.org', searchUrl: 'https://www.szyj.org/?s={q}', category: '易学' },
  { name: '中华易经网', baseUrl: 'https://www.zhonghuayijing.com', searchUrl: 'https://www.zhonghuayijing.com/?s={q}', category: '易学' },
  { name: '六爻预测', baseUrl: 'https://www.liuyaocs.com', searchUrl: 'https://www.liuyaocs.com/?s={q}', category: '六爻' },
  { name: '六爻铜钱', baseUrl: 'https://www.liuyao.com.cn', searchUrl: 'https://www.liuyao.com.cn/?s={q}', category: '六爻' },
  { name: '六爻预测网', baseUrl: 'https://www.liuyaoyc.com', searchUrl: 'https://www.liuyaoyc.com/?s={q}', category: '六爻' },
  { name: '梅花易数论坛', baseUrl: 'https://bbs.meihua.com', searchUrl: 'https://bbs.meihua.com/?s={q}', category: '梅花易数' },
  { name: '梅花数术', baseUrl: 'https://www.meihuashushu.com', searchUrl: 'https://www.meihuashushu.com/?s={q}', category: '梅花易数' },
  { name: '梅花预测', baseUrl: 'https://www.meihuayuce.com', searchUrl: 'https://www.meihuayuce.com/?s={q}', category: '梅花易数' },
  { name: '奇门遁甲在线', baseUrl: 'https://www.qmdjzx.com', searchUrl: 'https://www.qmdjzx.com/?s={q}', category: '奇门遁甲' },
  { name: '奇门排盘', baseUrl: 'https://www.qmpp.cn', searchUrl: 'https://www.qmpp.cn/?s={q}', category: '奇门遁甲' },
  { name: '奇门遁甲秘籍', baseUrl: 'https://www.qmdjmj.com', searchUrl: 'https://www.qmdjmj.com/?s={q}', category: '奇门遁甲' },
  { name: '大六壬大全', baseUrl: 'https://www.liurendaquan.com', searchUrl: 'https://www.liurendaquan.com/?s={q}', category: '大六壬' },
  { name: '六壬神课', baseUrl: 'https://www.liurenshenke.cn', searchUrl: 'https://www.liurenshenke.cn/?s={q}', category: '大六壬' },
  { name: '太乙神数', baseUrl: 'https://www.taiyishenshu.com', searchUrl: 'https://www.taiyishenshu.com/?s={q}', category: '太乙神数' },
  { name: '紫白飞星', baseUrl: 'https://www.zibaifeixing.com', searchUrl: 'https://www.zibaifeixing.com/?s={q}', category: '风水' },

  // ============ 第三批：相术 / 风水 ============
  { name: '相术学院', baseUrl: 'https://www.xsxy.com', searchUrl: 'https://www.xsxy.com/?s={q}', category: '相术' },
  { name: '麻衣相法', baseUrl: 'https://www.mayixiang.com', searchUrl: 'https://www.mayixiang.com/?s={q}', category: '相术' },
  { name: '柳庄相法', baseUrl: 'https://www.liuzhuangxiang.com', searchUrl: 'https://www.liuzhuangxiang.com/?s={q}', category: '相术' },
  { name: '神相全编', baseUrl: 'https://www.shenxiangqb.com', searchUrl: 'https://www.shenxiangqb.com/?s={q}', category: '相术' },
  { name: '冰鉴', baseUrl: 'https://www.bingjian.com', searchUrl: 'https://www.bingjian.com/?s={q}', category: '相术' },
  { name: '掌纹大全', baseUrl: 'https://www.zhangwen.cn', searchUrl: 'https://www.zhangwen.cn/?s={q}', category: '相术' },
  { name: '面相学网', baseUrl: 'https://www.mianxiangxue.com', searchUrl: 'https://www.mianxiangxue.com/?s={q}', category: '相术' },
  { name: '看相算命', baseUrl: 'https://www.kanxiang.cc', searchUrl: 'https://www.kanxiang.cc/?s={q}', category: '相术' },
  { name: '痣相大全', baseUrl: 'https://www.zhixiangdq.com', searchUrl: 'https://www.zhixiangdq.com/?s={q}', category: '相术' },
  { name: '骨相学', baseUrl: 'https://www.guxiangxue.com', searchUrl: 'https://www.guxiangxue.com/?s={q}', category: '相术' },

  { name: '风水罗盘', baseUrl: 'https://www.fengshuiluopan.com', searchUrl: 'https://www.fengshuiluopan.com/?s={q}', category: '风水' },
  { name: '住宅风水', baseUrl: 'https://www.zhufengshui.com', searchUrl: 'https://www.zhufengshui.com/?s={q}', category: '风水' },
  { name: '阳宅风水', baseUrl: 'https://www.yangzhaifs.com', searchUrl: 'https://www.yangzhaifs.com/?s={q}', category: '风水' },
  { name: '阴宅风水', baseUrl: 'https://www.yinzhaifs.com', searchUrl: 'https://www.yinzhaifs.com/?s={q}', category: '风水' },
  { name: '玄空飞星', baseUrl: 'https://www.xuankongfx.com', searchUrl: 'https://www.xuankongfx.com/?s={q}', category: '风水' },
  { name: '八宅风水', baseUrl: 'https://www.bazhaifs.com', searchUrl: 'https://www.bazhaifs.com/?s={q}', category: '风水' },
  { name: '三元风水', baseUrl: 'https://www.sanyuanfs.com', searchUrl: 'https://www.sanyuanfs.com/?s={q}', category: '风水' },
  { name: '三合风水', baseUrl: 'https://www.sanhefs.com', searchUrl: 'https://www.sanhefs.com/?s={q}', category: '风水' },
  { name: '风水堪舆', baseUrl: 'https://www.kanyu.com', searchUrl: 'https://www.kanyu.com/?s={q}', category: '风水' },
  { name: '杨公风水', baseUrl: 'https://www.yanggongfs.com', searchUrl: 'https://www.yanggongfs.com/?s={q}', category: '风水' },
  { name: '李居明风水', baseUrl: 'https://www.lijuming.com', searchUrl: 'https://www.lijuming.com/?s={q}', category: '风水' },
  { name: '风水大师网', baseUrl: 'https://www.fengshuids.com', searchUrl: 'https://www.fengshuids.com/?s={q}', category: '风水' },
  { name: '中国风水学院', baseUrl: 'https://www.chinafsxy.com', searchUrl: 'https://www.chinafsxy.com/?s={q}', category: '风水' },
  { name: '商业风水', baseUrl: 'https://www.syfs.cn', searchUrl: 'https://www.syfs.cn/?s={q}', category: '风水' },
  { name: '办公室风水', baseUrl: 'https://www.bgsfs.com', searchUrl: 'https://www.bgsfs.com/?s={q}', category: '风水' },

  // ============ 第四批：道家 / 丹道 / 内丹 ============
  { name: '中国道教协会', baseUrl: 'https://www.taoist.org.cn', searchUrl: 'https://www.taoist.org.cn/?s={q}', category: '道家' },
  { name: '道教之音', baseUrl: 'https://www.daoisms.org', searchUrl: 'https://www.daoisms.org/?s={q}', category: '道家' },
  { name: '腾讯道学', baseUrl: 'https://daoxue.qq.com', searchUrl: 'https://daoxue.qq.com/?s={q}', category: '道家' },
  { name: '道德经研究', baseUrl: 'https://www.daodejing.org', searchUrl: 'https://www.daodejing.org/?s={q}', category: '道家' },
  { name: '内丹学', baseUrl: 'https://www.neidan.cn', searchUrl: 'https://www.neidan.cn/?s={q}', category: '丹道' },
  { name: '丹道修真', baseUrl: 'https://www.dandao.org', searchUrl: 'https://www.dandao.org/?s={q}', category: '丹道' },
  { name: '中华道藏', baseUrl: 'https://www.zhdaozang.com', searchUrl: 'https://www.zhdaozang.com/?s={q}', category: '道家' },
  { name: '道家文化网', baseUrl: 'https://www.daojiawenhua.com', searchUrl: 'https://www.daojiawenhua.com/?s={q}', category: '道家' },
  { name: '武当道教', baseUrl: 'https://www.wudangdaojiao.com', searchUrl: 'https://www.wudangdaojiao.com/?s={q}', category: '道家' },
  { name: '龙虎山', baseUrl: 'https://www.longhushan.com', searchUrl: 'https://www.longhushan.com/?s={q}', category: '道家' },
  { name: '茅山道院', baseUrl: 'https://www.maoshan.com', searchUrl: 'https://www.maoshan.com/?s={q}', category: '道家' },
  { name: '青城山道教', baseUrl: 'https://www.qingchengshan.com', searchUrl: 'https://www.qingchengshan.com/?s={q}', category: '道家' },
  { name: '丹经汇编', baseUrl: 'https://www.danjingbook.com', searchUrl: 'https://www.danjingbook.com/?s={q}', category: '丹道' },
  { name: '太极阴阳', baseUrl: 'https://www.taijiyinyang.com', searchUrl: 'https://www.taijiyinyang.com/?s={q}', category: '道家' },
  { name: '道家养生', baseUrl: 'https://www.daoyangsheng.com', searchUrl: 'https://www.daoyangsheng.com/?s={q}', category: '道家' },

  // ============ 第五批：佛家 / 佛典 ============
  { name: '佛教在线', baseUrl: 'https://www.fjnet.com', searchUrl: 'https://www.fjnet.com/?s={q}', category: '佛家' },
  { name: '佛缘网', baseUrl: 'https://www.foyuan.net', searchUrl: 'https://www.foyuan.net/?s={q}', category: '佛家' },
  { name: '弘善佛教网', baseUrl: 'https://www.hongshanfo.com', searchUrl: 'https://www.hongshanfo.com/?s={q}', category: '佛家' },
  { name: '佛弟子文库', baseUrl: 'https://www.fodizi.tw', searchUrl: 'https://www.fodizi.tw/?s={q}', category: '佛家' },
  { name: '佛教经文', baseUrl: 'https://www.fjjwjy.com', searchUrl: 'https://www.fjjwjy.com/?s={q}', category: '佛家' },
  { name: '大藏经', baseUrl: 'https://www.dazangjing.com', searchUrl: 'https://www.dazangjing.com/?s={q}', category: '佛家' },
  { name: '佛经网', baseUrl: 'https://www.fojing.org', searchUrl: 'https://www.fojing.org/?s={q}', category: '佛家' },
  { name: '禅宗网', baseUrl: 'https://www.chanzong.cn', searchUrl: 'https://www.chanzong.cn/?s={q}', category: '佛家' },
  { name: '净土宗', baseUrl: 'https://www.jingtuzong.com', searchUrl: 'https://www.jingtuzong.com/?s={q}', category: '佛家' },
  { name: '密宗网', baseUrl: 'https://www.mizong.cn', searchUrl: 'https://www.mizong.cn/?s={q}', category: '佛家' },
  { name: '华严宗', baseUrl: 'https://www.huayanzong.com', searchUrl: 'https://www.huayanzong.com/?s={q}', category: '佛家' },
  { name: '天台宗', baseUrl: 'https://www.tiantaizong.com', searchUrl: 'https://www.tiantaizong.com/?s={q}', category: '佛家' },
  { name: '法相宗', baseUrl: 'https://www.faxiangzong.com', searchUrl: 'https://www.faxiangzong.com/?s={q}', category: '佛家' },
  { name: '律宗', baseUrl: 'https://www.luzong.com', searchUrl: 'https://www.luzong.com/?s={q}', category: '佛家' },
  { name: '三论宗', baseUrl: 'https://www.sanlunzong.com', searchUrl: 'https://www.sanlunzong.com/?s={q}', category: '佛家' },

  // ============ 第六批：中医 / 医家 ============
  { name: '中医基础理论', baseUrl: 'https://www.zyjichu.com', searchUrl: 'https://www.zyjichu.com/?s={q}', category: '中医' },
  { name: '黄帝内经研究', baseUrl: 'https://www.hdnj.org', searchUrl: 'https://www.hdnj.org/?s={q}', category: '中医' },
  { name: '伤寒论研究', baseUrl: 'https://www.shanghanlun.com', searchUrl: 'https://www.shanghanlun.com/?s={q}', category: '中医' },
  { name: '本草纲目网', baseUrl: 'https://www.bencaogm.com', searchUrl: 'https://www.bencaogm.com/?s={q}', category: '中医' },
  { name: '神农本草经', baseUrl: 'https://www.shennongbc.com', searchUrl: 'https://www.shennongbc.com/?s={q}', category: '中医' },
  { name: '难经研究', baseUrl: 'https://www.nanjingyj.com', searchUrl: 'https://www.nanjingyj.com/?s={q}', category: '中医' },
  { name: '金匮要略', baseUrl: 'https://www.jinguiyl.com', searchUrl: 'https://www.jinguiyl.com/?s={q}', category: '中医' },
  { name: '温病条辨', baseUrl: 'https://www.wenbingtb.com', searchUrl: 'https://www.wenbingtb.com/?s={q}', category: '中医' },
  { name: '中医方剂', baseUrl: 'https://www.zyfangji.com', searchUrl: 'https://www.zyfangji.com/?s={q}', category: '中医' },
  { name: '中医针灸', baseUrl: 'https://www.zyzj.com', searchUrl: 'https://www.zyzj.com/?s={q}', category: '中医' },
  { name: '中医按摩', baseUrl: 'https://www.zyanmo.com', searchUrl: 'https://www.zyanmo.com/?s={q}', category: '中医' },
  { name: '中医养生', baseUrl: 'https://www.zhongyiyangsheng.com', searchUrl: 'https://www.zhongyiyangsheng.com/?s={q}', category: '中医' },
  { name: '中医论坛', baseUrl: 'https://bbs.zhongyi.cc', searchUrl: 'https://bbs.zhongyi.cc/?s={q}', category: '中医' },
  { name: '岐黄之术', baseUrl: 'https://www.qihuangzs.com', searchUrl: 'https://www.qihuangzs.com/?s={q}', category: '中医' },
  { name: '医宗金鉴', baseUrl: 'https://www.yizongjj.com', searchUrl: 'https://www.yizongjj.com/?s={q}', category: '中医' },

  // ============ 第七批：经典 / 史书 / 子书 ============
  { name: '四库全书', baseUrl: 'https://www.sikuquanshu.com', searchUrl: 'https://www.sikuquanshu.com/?s={q}', category: '综合古籍' },
  { name: '四库全书电子版', baseUrl: 'https://www.skqs.com', searchUrl: 'https://www.skqs.com/?s={q}', category: '综合古籍' },
  { name: '诸子集成', baseUrl: 'https://www.zhuzijc.com', searchUrl: 'https://www.zhuzijc.com/?s={q}', category: '诸子' },
  { name: '十三经注疏', baseUrl: 'https://www.shisanjing.com', searchUrl: 'https://www.shisanjing.com/?s={q}', category: '经学' },
  { name: '二十四史', baseUrl: 'https://www.ershisi.org', searchUrl: 'https://www.ershisi.org/?s={q}', category: '史书' },
  { name: '资治通鉴', baseUrl: 'https://www.zztj.org', searchUrl: 'https://www.zztj.org/?s={q}', category: '史书' },
  { name: '春秋左传', baseUrl: 'https://www.zuozhuan.com', searchUrl: 'https://www.zuozhuan.com/?s={q}', category: '经学' },
  { name: '论语在线', baseUrl: 'https://www.lunyu.cn', searchUrl: 'https://www.lunyu.cn/?s={q}', category: '儒家' },
  { name: '孟子在线', baseUrl: 'https://www.mengzi.org', searchUrl: 'https://www.mengzi.org/?s={q}', category: '儒家' },
  { name: '大学中庸', baseUrl: 'https://www.daxuezhongyong.com', searchUrl: 'https://www.daxuezhongyong.com/?s={q}', category: '儒家' },
  { name: '老子道德经', baseUrl: 'https://www.laozi.net', searchUrl: 'https://www.laozi.net/?s={q}', category: '道家' },
  { name: '庄子在线', baseUrl: 'https://www.zhuangzi.com', searchUrl: 'https://www.zhuangzi.com/?s={q}', category: '道家' },
  { name: '列子', baseUrl: 'https://www.liezi.org', searchUrl: 'https://www.liezi.org/?s={q}', category: '道家' },
  { name: '荀子', baseUrl: 'https://www.xunzi.com', searchUrl: 'https://www.xunzi.com/?s={q}', category: '儒家' },
  { name: '韩非子', baseUrl: 'https://www.hanfeizi.com', searchUrl: 'https://www.hanfeizi.com/?s={q}', category: '法家' },
  { name: '墨子', baseUrl: 'https://www.mozi.org', searchUrl: 'https://www.mozi.org/?s={q}', category: '墨家' },
  { name: '管子', baseUrl: 'https://www.guanzi.com', searchUrl: 'https://www.guanzi.com/?s={q}', category: '诸子' },
  { name: '孙子兵法', baseUrl: 'https://www.sunzibingfa.com', searchUrl: 'https://www.sunzibingfa.com/?s={q}', category: '兵家' },
  { name: '六韬三略', baseUrl: 'https://www.liutaosanlue.com', searchUrl: 'https://www.liutaosanlue.com/?s={q}', category: '兵家' },
  { name: '吕氏春秋', baseUrl: 'https://www.lvshicq.com', searchUrl: 'https://www.lvshicq.com/?s={q}', category: '诸子' },
  { name: '淮南子', baseUrl: 'https://www.huainanzi.com', searchUrl: 'https://www.huainanzi.com/?s={q}', category: '诸子' },
  { name: '抱朴子', baseUrl: 'https://www.baopuzi.com', searchUrl: 'https://www.baopuzi.com/?s={q}', category: '道家' },
  { name: '太平经', baseUrl: 'https://www.taipingjing.com', searchUrl: 'https://www.taipingjing.com/?s={q}', category: '道家' },
  { name: '黄帝阴符经', baseUrl: 'https://www.yinfujing.com', searchUrl: 'https://www.yinfujing.com/?s={q}', category: '道家' },
  { name: '黄庭经', baseUrl: 'https://www.huangtingjing.com', searchUrl: 'https://www.huangtingjing.com/?s={q}', category: '道家' },
  { name: '参同契', baseUrl: 'https://www.cantongqi.com', searchUrl: 'https://www.cantongqi.com/?s={q}', category: '丹道' },
  { name: '悟真篇', baseUrl: 'https://www.wuzhenpian.com', searchUrl: 'https://www.wuzhenpian.com/?s={q}', category: '丹道' },
  { name: '楞严经', baseUrl: 'https://www.lengyanjing.com', searchUrl: 'https://www.lengyanjing.com/?s={q}', category: '佛家' },
  { name: '金刚经', baseUrl: 'https://www.jingangjing.org', searchUrl: 'https://www.jingangjing.org/?s={q}', category: '佛家' },
  { name: '心经', baseUrl: 'https://www.xinjing.org', searchUrl: 'https://www.xinjing.org/?s={q}', category: '佛家' },

  // ============ 第八批：综合古籍下载站 ============
  { name: '古籍馆', baseUrl: 'http://www.gujiguan.com', searchUrl: 'http://www.gujiguan.com/?s={q}', category: '综合古籍' },
  { name: '古籍下载网', baseUrl: 'https://www.gjxz.com', searchUrl: 'https://www.gjxz.com/?s={q}', category: '综合古籍' },
  { name: '中华典藏', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/?s={q}', category: '综合古籍' },
  { name: '汉典古籍', baseUrl: 'https://gj.cn', searchUrl: 'https://gj.cn/?s={q}', category: '综合古籍' },
  { name: '古籍阁', baseUrl: 'https://www.gujige.com', searchUrl: 'https://www.gujige.com/?s={q}', category: '综合古籍' },
  { name: '故纸录', baseUrl: 'https://www.guzhilu.com', searchUrl: 'https://www.guzhilu.com/?s={q}', category: '综合古籍' },
  { name: '古籍善本', baseUrl: 'https://www.shanben.cc', searchUrl: 'https://www.shanben.cc/?s={q}', category: '综合古籍' },
  { name: '古籍善本网', baseUrl: 'https://www.shanbenwang.com', searchUrl: 'https://www.shanbenwang.com/?s={q}', category: '综合古籍' },
  { name: '中华书局古籍', baseUrl: 'http://www.zhbc.com.cn', searchUrl: 'http://www.zhbc.com.cn/?s={q}', category: '综合古籍' },
  { name: '上海古籍出版社', baseUrl: 'http://www.guji.com.cn', searchUrl: 'http://www.guji.com.cn/?s={q}', category: '综合古籍' },
  { name: '岳麓书社', baseUrl: 'http://www.hnybook.com', searchUrl: 'http://www.hnybook.com/?s={q}', category: '综合古籍' },
  { name: '中州古籍', baseUrl: 'http://www.zzgjcb.com', searchUrl: 'http://www.zzgjcb.com/?s={q}', category: '综合古籍' },
  { name: '巴蜀书社', baseUrl: 'http://www.bashushushe.com', searchUrl: 'http://www.bashushushe.com/?s={q}', category: '综合古籍' },
  { name: '齐鲁书社', baseUrl: 'http://www.qilushushe.com', searchUrl: 'http://www.qilushushe.com/?s={q}', category: '综合古籍' },
  { name: '凤凰出版社', baseUrl: 'http://www.fhph.com.cn', searchUrl: 'http://www.fhph.com.cn/?s={q}', category: '综合古籍' },

  // ============ 第九批：综合文化 / 古典 ============
  { name: '诗词大全', baseUrl: 'https://www.shiciw.com', searchUrl: 'https://www.shiciw.com/?s={q}', category: '古典文学' },
  { name: '诗词中国', baseUrl: 'http://www.shichinese.com', searchUrl: 'http://www.shichinese.com/?s={q}', category: '古典文学' },
  { name: '宋词三百首', baseUrl: 'https://www.songci.com', searchUrl: 'https://www.songci.com/?s={q}', category: '古典文学' },
  { name: '唐诗三百首', baseUrl: 'https://www.tangshi.com', searchUrl: 'https://www.tangshi.com/?s={q}', category: '古典文学' },
  { name: '元曲三百首', baseUrl: 'https://www.yuanqu.com', searchUrl: 'https://www.yuanqu.com/?s={q}', category: '古典文学' },
  { name: '楚辞研究', baseUrl: 'https://www.chuci.com', searchUrl: 'https://www.chuci.com/?s={q}', category: '古典文学' },
  { name: '诗经研究', baseUrl: 'https://www.shijing.org', searchUrl: 'https://www.shijing.org/?s={q}', category: '古典文学' },
  { name: '汉赋研究', baseUrl: 'https://www.hanfu.com', searchUrl: 'https://www.hanfu.com/?s={q}', category: '古典文学' },
  { name: '骈文研究', baseUrl: 'https://www.pianwen.com', searchUrl: 'https://www.pianwen.com/?s={q}', category: '古典文学' },
  { name: '古文观止', baseUrl: 'https://www.guwenguanzhi.com', searchUrl: 'https://www.guwenguanzhi.com/?s={q}', category: '古典文学' },
  { name: '文心雕龙', baseUrl: 'https://www.wenxindiaolong.com', searchUrl: 'https://www.wenxindiaolong.com/?s={q}', category: '古典文学' },
  { name: '世说新语', baseUrl: 'https://www.shishuoxinyu.com', searchUrl: 'https://www.shishuoxinyu.com/?s={q}', category: '古典文学' },
  { name: '聊斋志异', baseUrl: 'https://www.liaozhai.com', searchUrl: 'https://www.liaozhai.com/?s={q}', category: '古典文学' },
  { name: '阅微草堂笔记', baseUrl: 'https://www.yuewei.com', searchUrl: 'https://www.yuewei.com/?s={q}', category: '古典文学' },
  { name: '子不语', baseUrl: 'https://www.zibuyu.com', searchUrl: 'https://www.zibuyu.com/?s={q}', category: '古典文学' },

  // ============ 第十批：海外华人 / 港台 / 简繁站点 ============
  { name: '台湾大学典藏数位化', baseUrl: 'https://dl.lib.ntu.edu.tw', searchUrl: 'https://dl.lib.ntu.edu.tw/?q={q}', category: '海外华人' },
  { name: '台湾故宫博物院', baseUrl: 'https://www.npm.gov.tw', searchUrl: 'https://www.npm.gov.tw/?q={q}', category: '海外华人' },
  { name: '香港中文大学古籍', baseUrl: 'https://www.lib.cuhk.edu.hk', searchUrl: 'https://www.lib.cuhk.edu.hk/?q={q}', category: '海外华人' },
  { name: '汉学研究中心', baseUrl: 'https://ccs.ncl.edu.tw', searchUrl: 'https://ccs.ncl.edu.tw/?q={q}', category: '海外华人' },
  { name: '中华电子佛典', baseUrl: 'https://www.cbeta.org', searchUrl: 'https://www.cbeta.org/?q={q}', category: '佛家' },
  { name: '汉籍电子文献资料库', baseUrl: 'https://hanchi.ihp.sinica.edu.tw', searchUrl: 'https://hanchi.ihp.sinica.edu.tw/?q={q}', category: '海外华人' },
  { name: '中央研究院汉籍', baseUrl: 'https://www.sinica.edu.tw', searchUrl: 'https://www.sinica.edu.tw/?q={q}', category: '海外华人' },
  { name: '寒泉古典文献', baseUrl: 'http://120.115.36.146/hanji/', searchUrl: 'http://120.115.36.146/hanji/?q={q}', category: '海外华人' },
  { name: '故宫书画图录', baseUrl: 'https://painting.npm.gov.tw', searchUrl: 'https://painting.npm.gov.tw/?q={q}', category: '海外华人' },
  { name: '台湾古籍联合目录', baseUrl: 'https://rbook.ncl.edu.tw', searchUrl: 'https://rbook.ncl.edu.tw/?q={q}', category: '海外华人' },
  { name: '汉文佛典', baseUrl: 'https://buddhism.lib.ntu.edu.tw', searchUrl: 'https://buddhism.lib.ntu.edu.tw/?q={q}', category: '佛家' },
  { name: 'CBETA电子佛典', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/?q={q}', category: '佛家' },
  { name: '繁体古籍善本', baseUrl: 'https://www.guoxue123.com', searchUrl: 'https://www.guoxue123.com/?s={q}', category: '综合古籍' },
  { name: '繁体易学网', baseUrl: 'https://www.yixue.com.tw', searchUrl: 'https://www.yixue.com.tw/?s={q}', category: '易学' },
  { name: '台湾命理网', baseUrl: 'https://www.mingli.com.tw', searchUrl: 'https://www.mingli.com.tw/?s={q}', category: '命理' },

  // ============ 第十一批：GitHub 开源中文古籍仓库 ============
  { name: 'chinese-poetry GitHub', baseUrl: 'https://github.com/chinese-poetry/chinese-poetry', searchUrl: 'https://github.com/chinese-poetry/chinese-poetry/search?q={q}', category: 'GitHub仓库' },
  { name: 'daizhigev20 GitHub', baseUrl: 'https://github.com/garychowcmu/daizhigev20', searchUrl: 'https://github.com/garychowcmu/daizhigev20/search?q={q}', category: 'GitHub仓库' },
  { name: 'caoanwww GitHub', baseUrl: 'https://github.com/caoanwww/Ancient-Chinese-Text', searchUrl: 'https://github.com/caoanwww/Ancient-Chinese-Text/search?q={q}', category: 'GitHub仓库' },
  { name: 'guji GitHub', baseUrl: 'https://github.com/topics/guji', searchUrl: 'https://github.com/topics/guji?q={q}', category: 'GitHub仓库' },
  { name: 'yijing GitHub', baseUrl: 'https://github.com/topics/yijing', searchUrl: 'https://github.com/topics/yijing?q={q}', category: 'GitHub仓库' },
  { name: 'bazi GitHub', baseUrl: 'https://github.com/topics/bazi', searchUrl: 'https://github.com/topics/bazi?q={q}', category: 'GitHub仓库' },
  { name: 'fengshui GitHub', baseUrl: 'https://github.com/topics/fengshui', searchUrl: 'https://github.com/topics/fengshui?q={q}', category: 'GitHub仓库' },
  { name: 'ziwei GitHub', baseUrl: 'https://github.com/topics/ziwei', searchUrl: 'https://github.com/topics/ziwei?q={q}', category: 'GitHub仓库' },
  { name: 'qimen GitHub', baseUrl: 'https://github.com/topics/qimen', searchUrl: 'https://github.com/topics/qimen?q={q}', category: 'GitHub仓库' },
  { name: 'liuyao GitHub', baseUrl: 'https://github.com/topics/liuyao', searchUrl: 'https://github.com/topics/liuyao?q={q}', category: 'GitHub仓库' },
  { name: 'meihua GitHub', baseUrl: 'https://github.com/topics/meihua', searchUrl: 'https://github.com/topics/meihua?q={q}', category: 'GitHub仓库' },
  { name: 'taoist GitHub', baseUrl: 'https://github.com/topics/taoist', searchUrl: 'https://github.com/topics/taoist?q={q}', category: 'GitHub仓库' },
  { name: 'buddhist GitHub', baseUrl: 'https://github.com/topics/buddhist', searchUrl: 'https://github.com/topics/buddhist?q={q}', category: 'GitHub仓库' },
  { name: 'chinese-medicine GitHub', baseUrl: 'https://github.com/topics/chinese-medicine', searchUrl: 'https://github.com/topics/chinese-medicine?q={q}', category: 'GitHub仓库' },
  { name: 'classical-chinese GitHub', baseUrl: 'https://github.com/topics/classical-chinese', searchUrl: 'https://github.com/topics/classical-chinese?q={q}', category: 'GitHub仓库' },

  // ============ 第十二批：图书馆 / 学术资源 ============
  { name: '国家图书馆', baseUrl: 'http://www.nlc.cn', searchUrl: 'http://www.nlc.cn/?q={q}', category: '图书馆' },
  { name: '中华古籍资源库', baseUrl: 'http://read.nlc.cn', searchUrl: 'http://read.nlc.cn/?q={q}', category: '图书馆' },
  { name: '国家数字图书馆', baseUrl: 'http://www.ndlib.cn', searchUrl: 'http://www.ndlib.cn/?q={q}', category: '图书馆' },
  { name: '上海图书馆古籍', baseUrl: 'http://www.library.sh.cn', searchUrl: 'http://www.library.sh.cn/?q={q}', category: '图书馆' },
  { name: '北京大学图书馆', baseUrl: 'https://www.lib.pku.edu.cn', searchUrl: 'https://www.lib.pku.edu.cn/?q={q}', category: '图书馆' },
  { name: '清华大学图书馆', baseUrl: 'https://lib.tsinghua.edu.cn', searchUrl: 'https://lib.tsinghua.edu.cn/?q={q}', category: '图书馆' },
  { name: '南京图书馆', baseUrl: 'http://www.jslib.org.cn', searchUrl: 'http://www.jslib.org.cn/?q={q}', category: '图书馆' },
  { name: '中山大学图书馆', baseUrl: 'https://library.sysu.edu.cn', searchUrl: 'https://library.sysu.edu.cn/?q={q}', category: '图书馆' },
  { name: '浙江大学图书馆', baseUrl: 'https://libweb.zju.edu.cn', searchUrl: 'https://libweb.zju.edu.cn/?q={q}', category: '图书馆' },
  { name: '武汉大学图书馆', baseUrl: 'https://www.lib.whu.edu.cn', searchUrl: 'https://www.lib.whu.edu.cn/?q={q}', category: '图书馆' },
  { name: '哈佛燕京图书馆', baseUrl: 'https://library.harvard.edu', searchUrl: 'https://library.harvard.edu/?q={q}', category: '海外图书馆' },
  { name: '哥伦比亚大学东亚图书馆', baseUrl: 'https://library.columbia.edu', searchUrl: 'https://library.columbia.edu/?q={q}', category: '海外图书馆' },
  { name: '加州大学伯克利分校东亚图书馆', baseUrl: 'https://www.lib.berkeley.edu', searchUrl: 'https://www.lib.berkeley.edu/?q={q}', category: '海外图书馆' },
  { name: '京都大学人文研', baseUrl: 'https://www.zinbun.kyoto-u.ac.jp', searchUrl: 'https://www.zinbun.kyoto-u.ac.jp/?q={q}', category: '海外图书馆' },
  { name: '日本国立公文书馆', baseUrl: 'https://www.archives.go.jp', searchUrl: 'https://www.archives.go.jp/?q={q}', category: '海外图书馆' },

  // ============ 第十四批：网盘资源搜索 ============
  { name: '盘搜搜', baseUrl: 'https://www.pansou.com', searchUrl: 'https://www.pansou.com/?q={q}', category: '网盘搜索' },
  { name: '云盘大全', baseUrl: 'https://www.yunpandq.com', searchUrl: 'https://www.yunpandq.com/?s={q}', category: '网盘搜索' },
  { name: '盘多多', baseUrl: 'https://www.panduoduo.net', searchUrl: 'https://www.panduoduo.net/?q={q}', category: '网盘搜索' },
  { name: '百度网盘搜索', baseUrl: 'https://www.bdwpzhushou.com', searchUrl: 'https://www.bdwpzhushou.com/?q={q}', category: '网盘搜索' },
  { name: '小白盘', baseUrl: 'https://xiaobaipan.com', searchUrl: 'https://xiaobaipan.com/?q={q}', category: '网盘搜索' },
  { name: '凌风云搜索', baseUrl: 'https://www.lingfengyun.com', searchUrl: 'https://www.lingfengyun.com/?q={q}', category: '网盘搜索' },
  { name: '云盘集中营', baseUrl: 'https://www.yunpanjzy.com', searchUrl: 'https://www.yunpanjzy.com/?s={q}', category: '网盘搜索' },
  { name: '猫狸盘搜', baseUrl: 'https://www.alipansou.com', searchUrl: 'https://www.alipansou.com/?q={q}', category: '网盘搜索' },
  { name: '老司机盘搜', baseUrl: 'https://www.laosj.club', searchUrl: 'https://www.laosj.club/?q={q}', category: '网盘搜索' },
  { name: '盘资源', baseUrl: 'https://www.panziyuan.com', searchUrl: 'https://www.panziyuan.com/?q={q}', category: '网盘搜索' },

  // ============ 第十五批：玄学论坛 / 社区 ============
  { name: '玄学吧贴吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=玄学&q={q}', category: '论坛' },
  { name: '命理吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=命理&q={q}', category: '论坛' },
  { name: '周易吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=周易&q={q}', category: '论坛' },
  { name: '风水吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=风水&q={q}', category: '论坛' },
  { name: '紫微斗数吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=紫微斗数&q={q}', category: '论坛' },
  { name: '奇门遁甲吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=奇门遁甲&q={q}', category: '论坛' },
  { name: '梅花易数吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=梅花易数&q={q}', category: '论坛' },
  { name: '六爻吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=六爻&q={q}', category: '论坛' },
  { name: '八字吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=八字&q={q}', category: '论坛' },
  { name: '相术吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=相术&q={q}', category: '论坛' },
  { name: '道家吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=道家&q={q}', category: '论坛' },
  { name: '丹道吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=丹道&q={q}', category: '论坛' },
  { name: '佛学吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=佛学&q={q}', category: '论坛' },
  { name: '中医吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=中医&q={q}', category: '论坛' },
  { name: '国学吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=国学&q={q}', category: '论坛' },
  { name: '古籍吧', baseUrl: 'https://tieba.baidu.com', searchUrl: 'https://tieba.baidu.com/f?kw=古籍&q={q}', category: '论坛' },

  // ============ 第十六批：电子书库 / archive ============
  { name: 'archive.org', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search?query={q}', category: '电子书库' },
  { name: 'Z-Library', baseUrl: 'https://zh.z-lib.io', searchUrl: 'https://zh.z-lib.io/?q={q}', category: '电子书库' },
  { name: '鸠摩搜索', baseUrl: 'https://www.jiumodiary.com', searchUrl: 'https://www.jiumodiary.com/?q={q}', category: '电子书库' },
  { name: '熊猫搜书', baseUrl: 'https://xmsoushu.com', searchUrl: 'https://xmsoushu.com/?q={q}', category: '电子书库' },
  { name: '苦瓜书盘', baseUrl: 'https://www.kgbook.com', searchUrl: 'https://www.kgbook.com/?q={q}', category: '电子书库' },
  { name: '搜书吧', baseUrl: 'https://www.soushu8.com', searchUrl: 'https://www.soushu8.com/?q={q}', category: '电子书库' },
  { name: '免费电子书下载', baseUrl: 'https://www.mfdzs.com', searchUrl: 'https://www.mfdzs.com/?s={q}', category: '电子书库' },
  { name: '雅书', baseUrl: 'https://www.yabook.org', searchUrl: 'https://www.yabook.org/?q={q}', category: '电子书库' },
  { name: '云海电子书', baseUrl: 'https://www.yunhaiebook.com', searchUrl: 'https://www.yunhaiebook.com/?q={q}', category: '电子书库' },
  { name: '掌上书院', baseUrl: 'https://www.zhangshangshuyuan.com', searchUrl: 'https://www.zhangshangshuyuan.com/?q={q}', category: '电子书库' },

  // ============ 第十七批：道教站点 ============
  { name: '中华道教网', baseUrl: 'http://www.daoisms.org', searchUrl: 'http://www.daoisms.org/?q={q}', category: '道教' },
  { name: '道教文化', baseUrl: 'http://www.daoism.cn', searchUrl: 'http://www.daoism.cn/?q={q}', category: '道教' },
  { name: '道教在线', baseUrl: 'http://www.daoisms.cn', searchUrl: 'http://www.daoisms.cn/?q={q}', category: '道教' },
  { name: '正一道教', baseUrl: 'http://www.zhengyi.org', searchUrl: 'http://www.zhengyi.org/?q={q}', category: '道教' },
  { name: '全真道教', baseUrl: 'http://www.quanzhen.org', searchUrl: 'http://www.quanzhen.org/?q={q}', category: '道教' },
  { name: '武当道教协会', baseUrl: 'http://www.wddjxh.com', searchUrl: 'http://www.wddjxh.com/?q={q}', category: '道教' },
  { name: '青城山道教', baseUrl: 'http://www.qingchengshan.cn', searchUrl: 'http://www.qingchengshan.cn/?q={q}', category: '道教' },
  { name: '茅山道院', baseUrl: 'http://www.maoshandao.com', searchUrl: 'http://www.maoshandao.com/?q={q}', category: '道教' },
  { name: '龙虎山道教', baseUrl: 'http://www.lhsdj.com', searchUrl: 'http://www.lhsdj.com/?q={q}', category: '道教' },
  { name: '道家文化研究院', baseUrl: 'http://www.daojia.com', searchUrl: 'http://www.daojia.com/?q={q}', category: '道教' },
  { name: '内丹学堂', baseUrl: 'http://www.neidan.org', searchUrl: 'http://www.neidan.org/?q={q}', category: '道教' },
  { name: '丹道修真网', baseUrl: 'http://www.dandao.org', searchUrl: 'http://www.dandao.org/?q={q}', category: '道教' },
  { name: '中国道教协会', baseUrl: 'http://www.taoist.org.cn', searchUrl: 'http://www.taoist.org.cn/?q={q}', category: '道教' },
  { name: '道教文化资料库', baseUrl: 'http://www.daoinfo.org', searchUrl: 'http://www.daoinfo.org/?q={q}', category: '道教' },
  { name: '道藏精华', baseUrl: 'http://www.daozang.org', searchUrl: 'http://www.daozang.org/?q={q}', category: '道教' },

  // ============ 第十八批：易学专业站点 ============
  { name: '易学网', baseUrl: 'http://www.zhouyi.cc', searchUrl: 'http://www.zhouyi.cc/?q={q}', category: '易学' },
  { name: '中华易经网', baseUrl: 'http://www.yijing.cn', searchUrl: 'http://www.yijing.cn/?q={q}', category: '易学' },
  { name: '周易研究院', baseUrl: 'http://www.zhouyi.org', searchUrl: 'http://www.zhouyi.org/?q={q}', category: '易学' },
  { name: '易经研究会', baseUrl: 'http://www.yijing.org.cn', searchUrl: 'http://www.yijing.org.cn/?q={q}', category: '易学' },
  { name: '易学大讲堂', baseUrl: 'http://www.yixuedjt.com', searchUrl: 'http://www.yixuedjt.com/?q={q}', category: '易学' },
  { name: '中国易学网', baseUrl: 'http://www.zhongguoyixue.com', searchUrl: 'http://www.zhongguoyixue.com/?q={q}', category: '易学' },
  { name: '易经百科', baseUrl: 'http://www.yijingbaike.com', searchUrl: 'http://www.yijingbaike.com/?q={q}', category: '易学' },
  { name: '周易文化', baseUrl: 'http://www.zhouyiwh.com', searchUrl: 'http://www.zhouyiwh.com/?q={q}', category: '易学' },
  { name: '易学典籍', baseUrl: 'http://www.yixuedj.com', searchUrl: 'http://www.yixuedj.com/?q={q}', category: '易学' },
  { name: '易海拾贝', baseUrl: 'http://www.yihaishi.com', searchUrl: 'http://www.yihaishi.com/?q={q}', category: '易学' },
  { name: '易经研究网', baseUrl: 'http://www.yjyjw.com', searchUrl: 'http://www.yjyjw.com/?q={q}', category: '易学' },
  { name: '周易天地', baseUrl: 'http://www.zytd.org', searchUrl: 'http://www.zytd.org/?q={q}', category: '易学' },
  { name: '易学论坛', baseUrl: 'http://www.yixuebbs.com', searchUrl: 'http://www.yixuebbs.com/?q={q}', category: '易学' },
  { name: '中华易学院', baseUrl: 'http://www.zhyxy.org', searchUrl: 'http://www.zhyxy.org/?q={q}', category: '易学' },
  { name: '易学经典网', baseUrl: 'http://www.yxjd.com', searchUrl: 'http://www.yxjd.com/?q={q}', category: '易学' },

  // ============ 第十九批：八字 / 命理实战站点 ============
  { name: '中华命理网', baseUrl: 'http://www.zhmingli.com', searchUrl: 'http://www.zhmingli.com/?q={q}', category: '命理' },
  { name: '八字算命网', baseUrl: 'http://www.bazi.com.cn', searchUrl: 'http://www.bazi.com.cn/?q={q}', category: '命理' },
  { name: '四柱八字', baseUrl: 'http://www.sizhubazi.com', searchUrl: 'http://www.sizhubazi.com/?q={q}', category: '命理' },
  { name: '八字精批', baseUrl: 'http://www.bazijp.com', searchUrl: 'http://www.bazijp.com/?q={q}', category: '命理' },
  { name: '命理实战', baseUrl: 'http://www.mingli.org', searchUrl: 'http://www.mingli.org/?q={q}', category: '命理' },
  { name: '子平八字', baseUrl: 'http://www.ziping.com', searchUrl: 'http://www.ziping.com/?q={q}', category: '命理' },
  { name: '盲派八字', baseUrl: 'http://www.mangpai.com', searchUrl: 'http://www.mangpai.com/?q={q}', category: '命理' },
  { name: '滴天髓研究', baseUrl: 'http://www.ditianshui.org', searchUrl: 'http://www.ditianshui.org/?q={q}', category: '命理' },
  { name: '穷通宝鉴网', baseUrl: 'http://www.qiongtong.com', searchUrl: 'http://www.qiongtong.com/?q={q}', category: '命理' },
  { name: '三命通会论坛', baseUrl: 'http://www.smtonghui.com', searchUrl: 'http://www.smtonghui.com/?q={q}', category: '命理' },
  { name: '渊海子平网', baseUrl: 'http://www.yuanhaiziping.com', searchUrl: 'http://www.yuanhaiziping.com/?q={q}', category: '命理' },
  { name: '子平真诠网', baseUrl: 'http://www.zhenquan.com', searchUrl: 'http://www.zhenquan.com/?q={q}', category: '命理' },
  { name: '神峰通考网', baseUrl: 'http://www.shenfengtongkao.com', searchUrl: 'http://www.shenfengtongkao.com/?q={q}', category: '命理' },
  { name: '李虚中命书', baseUrl: 'http://www.lixuzhong.com', searchUrl: 'http://www.lixuzhong.com/?q={q}', category: '命理' },
  { name: '万育吾', baseUrl: 'http://www.wanyuwu.com', searchUrl: 'http://www.wanyuwu.com/?q={q}', category: '命理' },

  // ============ 第二十批：紫微 / 奇门 / 六壬 / 梅花专业站 ============
  { name: '紫微斗数论坛', baseUrl: 'http://www.ziwei.cn', searchUrl: 'http://www.ziwei.cn/?q={q}', category: '紫微' },
  { name: '紫微在线', baseUrl: 'http://www.ziweionline.com', searchUrl: 'http://www.ziweionline.com/?q={q}', category: '紫微' },
  { name: '紫微斗数全书', baseUrl: 'http://www.ziweidoushu.com', searchUrl: 'http://www.ziweidoushu.com/?q={q}', category: '紫微' },
  { name: '中州派紫微', baseUrl: 'http://www.zhongzhou.com', searchUrl: 'http://www.zhongzhou.com/?q={q}', category: '紫微' },
  { name: '飞星紫微', baseUrl: 'http://www.feixingziwei.com', searchUrl: 'http://www.feixingziwei.com/?q={q}', category: '紫微' },
  { name: '奇门遁甲网', baseUrl: 'http://www.qimendunjia.com', searchUrl: 'http://www.qimendunjia.com/?q={q}', category: '奇门' },
  { name: '奇门在线', baseUrl: 'http://www.qimenonline.com', searchUrl: 'http://www.qimenonline.com/?q={q}', category: '奇门' },
  { name: '阴盘奇门', baseUrl: 'http://www.yinpan.com', searchUrl: 'http://www.yinpan.com/?q={q}', category: '奇门' },
  { name: '阳盘奇门', baseUrl: 'http://www.yangpan.com', searchUrl: 'http://www.yangpan.com/?q={q}', category: '奇门' },
  { name: '飞盘奇门', baseUrl: 'http://www.feipanqimen.com', searchUrl: 'http://www.feipanqimen.com/?q={q}', category: '奇门' },
  { name: '大六壬网', baseUrl: 'http://www.daliuren.com', searchUrl: 'http://www.daliuren.com/?q={q}', category: '六壬' },
  { name: '六壬大全', baseUrl: 'http://www.liurendq.com', searchUrl: 'http://www.liurendq.com/?q={q}', category: '六壬' },
  { name: '小六壬', baseUrl: 'http://www.xiaoliuren.com', searchUrl: 'http://www.xiaoliuren.com/?q={q}', category: '六壬' },
  { name: '梅花易数网', baseUrl: 'http://www.meihuayishu.com', searchUrl: 'http://www.meihuayishu.com/?q={q}', category: '梅花' },
  { name: '邵雍研究', baseUrl: 'http://www.shaoyong.com', searchUrl: 'http://www.shaoyong.com/?q={q}', category: '梅花' },

  // ============ 第二十一批：风水 / 玄空 / 八宅 ============
  { name: '中华风水网', baseUrl: 'http://www.zhfsw.com', searchUrl: 'http://www.zhfsw.com/?q={q}', category: '风水' },
  { name: '风水在线', baseUrl: 'http://www.fengshui.cn', searchUrl: 'http://www.fengshui.cn/?q={q}', category: '风水' },
  { name: '玄空风水网', baseUrl: 'http://www.xuankong.com', searchUrl: 'http://www.xuankong.com/?q={q}', category: '风水' },
  { name: '八宅明镜', baseUrl: 'http://www.bazhai.org', searchUrl: 'http://www.bazhai.org/?q={q}', category: '风水' },
  { name: '三元风水', baseUrl: 'http://www.sanyuan.com', searchUrl: 'http://www.sanyuan.com/?q={q}', category: '风水' },
  { name: '三合风水', baseUrl: 'http://www.sanhe.com', searchUrl: 'http://www.sanhe.com/?q={q}', category: '风水' },
  { name: '形势派风水', baseUrl: 'http://www.xingshipai.com', searchUrl: 'http://www.xingshipai.com/?q={q}', category: '风水' },
  { name: '理气派风水', baseUrl: 'http://www.liqipai.com', searchUrl: 'http://www.liqipai.com/?q={q}', category: '风水' },
  { name: '阳宅风水网', baseUrl: 'http://www.yangzhai.com', searchUrl: 'http://www.yangzhai.com/?q={q}', category: '风水' },
  { name: '阴宅风水', baseUrl: 'http://www.yinzhai.com', searchUrl: 'http://www.yinzhai.com/?q={q}', category: '风水' },
  { name: '青囊经研究', baseUrl: 'http://www.qingnangjing.com', searchUrl: 'http://www.qingnangjing.com/?q={q}', category: '风水' },
  { name: '葬经研究', baseUrl: 'http://www.zangjing.com', searchUrl: 'http://www.zangjing.com/?q={q}', category: '风水' },
  { name: '撼龙经', baseUrl: 'http://www.hanlongjing.com', searchUrl: 'http://www.hanlongjing.com/?q={q}', category: '风水' },
  { name: '催官篇研究', baseUrl: 'http://www.cuiguan.com', searchUrl: 'http://www.cuiguan.com/?q={q}', category: '风水' },
  { name: '黄帝宅经', baseUrl: 'http://www.huangdizhaijing.com', searchUrl: 'http://www.huangdizhaijing.com/?q={q}', category: '风水' },

  // ============ 第二十二批：姓名学 / 测字 / 起名 ============
  { name: '中华姓名网', baseUrl: 'http://www.zhxingming.com', searchUrl: 'http://www.zhxingming.com/?q={q}', category: '姓名学' },
  { name: '康熙字典网', baseUrl: 'http://www.kxzd.com', searchUrl: 'http://www.kxzd.com/?q={q}', category: '姓名学' },
  { name: '说文解字', baseUrl: 'http://www.shuowen.org', searchUrl: 'http://www.shuowen.org/?q={q}', category: '姓名学' },
  { name: '姓名测试', baseUrl: 'http://www.xingming.com', searchUrl: 'http://www.xingming.com/?q={q}', category: '姓名学' },
  { name: '起名网', baseUrl: 'http://www.qiming.com', searchUrl: 'http://www.qiming.com/?q={q}', category: '姓名学' },
  { name: '宝宝起名', baseUrl: 'http://www.baobaoqiming.com', searchUrl: 'http://www.baobaoqiming.com/?q={q}', category: '姓名学' },
  { name: '五格剖象', baseUrl: 'http://www.wugepouxiang.com', searchUrl: 'http://www.wugepouxiang.com/?q={q}', category: '姓名学' },
  { name: '三才五格', baseUrl: 'http://www.sancaiwuge.com', searchUrl: 'http://www.sancaiwuge.com/?q={q}', category: '姓名学' },
  { name: '测字解梦', baseUrl: 'http://www.cezi.com', searchUrl: 'http://www.cezi.com/?q={q}', category: '姓名学' },
  { name: '周易起名', baseUrl: 'http://www.zhouyiqiming.com', searchUrl: 'http://www.zhouyiqiming.com/?q={q}', category: '姓名学' },

  // ============ 第二十三批：相术 / 面相 / 手相 ============
  { name: '中华相术网', baseUrl: 'http://www.zhxiangshu.com', searchUrl: 'http://www.zhxiangshu.com/?q={q}', category: '相术' },
  { name: '面相学网', baseUrl: 'http://www.mianxiang.com', searchUrl: 'http://www.mianxiang.com/?q={q}', category: '相术' },
  { name: '手相学网', baseUrl: 'http://www.shouxiang.com', searchUrl: 'http://www.shouxiang.com/?q={q}', category: '相术' },
  { name: '骨相学', baseUrl: 'http://www.guxiang.com', searchUrl: 'http://www.guxiang.com/?q={q}', category: '相术' },
  { name: '体相学', baseUrl: 'http://www.tixiang.com', searchUrl: 'http://www.tixiang.com/?q={q}', category: '相术' },
  { name: '麻衣神相网', baseUrl: 'http://www.mayishenxiang.com', searchUrl: 'http://www.mayishenxiang.com/?q={q}', category: '相术' },
  { name: '柳庄相法', baseUrl: 'http://www.liuzhuangxiang.com', searchUrl: 'http://www.liuzhuangxiang.com/?q={q}', category: '相术' },
  { name: '冰鉴研究', baseUrl: 'http://www.bingjian.com', searchUrl: 'http://www.bingjian.com/?q={q}', category: '相术' },
  { name: '神相全编', baseUrl: 'http://www.shenxiang.com', searchUrl: 'http://www.shenxiang.com/?q={q}', category: '相术' },
  { name: '相理衡真', baseUrl: 'http://www.xianglihengzhen.com', searchUrl: 'http://www.xianglihengzhen.com/?q={q}', category: '相术' },

  // ============ 第二十四批：占卜 / 塔罗 / 六爻 ============
  { name: '中华占卜网', baseUrl: 'http://www.zhzhanbu.com', searchUrl: 'http://www.zhzhanbu.com/?q={q}', category: '占卜' },
  { name: '六爻在线', baseUrl: 'http://www.liuyao.cn', searchUrl: 'http://www.liuyao.cn/?q={q}', category: '占卜' },
  { name: '增删卜易', baseUrl: 'http://www.zengshanbuyi.com', searchUrl: 'http://www.zengshanbuyi.com/?q={q}', category: '占卜' },
  { name: '卜筮正宗', baseUrl: 'http://www.bushizhengzong.com', searchUrl: 'http://www.bushizhengzong.com/?q={q}', category: '占卜' },
  { name: '火珠林', baseUrl: 'http://www.huozhulin.com', searchUrl: 'http://www.huozhulin.com/?q={q}', category: '占卜' },
  { name: '黄金策', baseUrl: 'http://www.huangjince.com', searchUrl: 'http://www.huangjince.com/?q={q}', category: '占卜' },
  { name: '断易天机', baseUrl: 'http://www.duanyitianji.com', searchUrl: 'http://www.duanyitianji.com/?q={q}', category: '占卜' },
  { name: '塔罗在线', baseUrl: 'http://www.taluo.cn', searchUrl: 'http://www.taluo.cn/?q={q}', category: '占卜' },
  { name: '中华神煞网', baseUrl: 'http://www.shensha.com', searchUrl: 'http://www.shensha.com/?q={q}', category: '占卜' },
  { name: '解梦大全', baseUrl: 'http://www.jiemengdq.com', searchUrl: 'http://www.jiemengdq.com/?q={q}', category: '占卜' },

  // ============ 第二十五批：博客 / 个人站 ============
  { name: '玄学博客', baseUrl: 'http://blog.sina.com.cn', searchUrl: 'http://blog.sina.com.cn/?q={q}', category: '博客' },
  { name: '命理博客', baseUrl: 'http://www.mingli-blog.com', searchUrl: 'http://www.mingli-blog.com/?q={q}', category: '博客' },
  { name: '周易博客', baseUrl: 'http://www.zhouyi-blog.com', searchUrl: 'http://www.zhouyi-blog.com/?q={q}', category: '博客' },
  { name: '风水博客', baseUrl: 'http://www.fengshui-blog.com', searchUrl: 'http://www.fengshui-blog.com/?q={q}', category: '博客' },
  { name: '紫微博客', baseUrl: 'http://www.ziwei-blog.com', searchUrl: 'http://www.ziwei-blog.com/?q={q}', category: '博客' },
  { name: '奇门博客', baseUrl: 'http://www.qimen-blog.com', searchUrl: 'http://www.qimen-blog.com/?q={q}', category: '博客' },
  { name: '梅花博客', baseUrl: 'http://www.meihua-blog.com', searchUrl: 'http://www.meihua-blog.com/?q={q}', category: '博客' },
  { name: '六爻博客', baseUrl: 'http://www.liuyao-blog.com', searchUrl: 'http://www.liuyao-blog.com/?q={q}', category: '博客' },
  { name: '相术博客', baseUrl: 'http://www.xiangshu-blog.com', searchUrl: 'http://www.xiangshu-blog.com/?q={q}', category: '博客' },
  { name: '道教博客', baseUrl: 'http://www.daojiao-blog.com', searchUrl: 'http://www.daojiao-blog.com/?q={q}', category: '博客' },

  // ============ 第二十六批：经典原文站点 ============
  { name: '中华经典网', baseUrl: 'http://www.zhonghuajingdian.com', searchUrl: 'http://www.zhonghuajingdian.com/?q={q}', category: '经典原文' },
  { name: '诗词中国', baseUrl: 'http://www.shici.com', searchUrl: 'http://www.shici.com/?q={q}', category: '经典原文' },
  { name: '古典文学网', baseUrl: 'http://www.gudianwenxue.com', searchUrl: 'http://www.gudianwenxue.com/?q={q}', category: '经典原文' },
  { name: '汉典', baseUrl: 'http://www.zdic.net', searchUrl: 'http://www.zdic.net/?q={q}', category: '经典原文' },
  { name: '汉典古籍', baseUrl: 'http://www.handian.org', searchUrl: 'http://www.handian.org/?q={q}', category: '经典原文' },
  { name: '汉文化网', baseUrl: 'http://www.hanwenhua.com', searchUrl: 'http://www.hanwenhua.com/?q={q}', category: '经典原文' },
  { name: '国学大师', baseUrl: 'http://www.guoxuedashi.com', searchUrl: 'http://www.guoxuedashi.com/?q={q}', category: '经典原文' },
  { name: '国学经典', baseUrl: 'http://www.guoxuejingdian.com', searchUrl: 'http://www.guoxuejingdian.com/?q={q}', category: '经典原文' },
  { name: '国学百科', baseUrl: 'http://www.guoxuebaike.com', searchUrl: 'http://www.guoxuebaike.com/?q={q}', category: '经典原文' },
  { name: '汉典网', baseUrl: 'http://www.handian.com', searchUrl: 'http://www.handian.com/?q={q}', category: '经典原文' },
  { name: '中华典籍', baseUrl: 'http://www.zhdianji.com', searchUrl: 'http://www.zhdianji.com/?q={q}', category: '经典原文' },
  { name: '古文献网', baseUrl: 'http://www.guwenxian.com', searchUrl: 'http://www.guwenxian.com/?q={q}', category: '经典原文' },
  { name: '古今注', baseUrl: 'http://www.gujinzhu.com', searchUrl: 'http://www.gujinzhu.com/?q={q}', category: '经典原文' },
  { name: '四部丛刊', baseUrl: 'http://www.sibu.com', searchUrl: 'http://www.sibu.com/?q={q}', category: '经典原文' },
  { name: '四库全书', baseUrl: 'http://www.siku.com', searchUrl: 'http://www.siku.com/?q={q}', category: '经典原文' },

  // ============ 第二十七批：百科类 / 知识库 ============
  { name: '维基百科', baseUrl: 'https://zh.wikipedia.org', searchUrl: 'https://zh.wikipedia.org/wiki/{q}', category: '百科' },
  { name: '百度百科', baseUrl: 'https://baike.baidu.com', searchUrl: 'https://baike.baidu.com/item/{q}', category: '百科' },
  { name: '互动百科', baseUrl: 'https://www.baike.com', searchUrl: 'https://www.baike.com/item/{q}', category: '百科' },
  { name: '搜狗百科', baseUrl: 'https://baike.sogou.com', searchUrl: 'https://baike.sogou.com/?query={q}', category: '百科' },
  { name: '中文维基文库', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/{q}', category: '百科' },
  { name: '英文维基百科', baseUrl: 'https://en.wikipedia.org', searchUrl: 'https://en.wikipedia.org/wiki/{q}', category: '百科' },
  { name: '萌娘百科', baseUrl: 'https://zh.moegirl.org.cn', searchUrl: 'https://zh.moegirl.org.cn/{q}', category: '百科' },
  { name: '汉语百科', baseUrl: 'https://www.cnbaike.com', searchUrl: 'https://www.cnbaike.com/?q={q}', category: '百科' },
  { name: '简书', baseUrl: 'https://www.jianshu.com', searchUrl: 'https://www.jianshu.com/search?q={q}', category: '百科' },
  { name: '知乎', baseUrl: 'https://www.zhihu.com', searchUrl: 'https://www.zhihu.com/search?type=content&q={q}', category: '百科' },
  { name: '豆瓣读书', baseUrl: 'https://book.douban.com', searchUrl: 'https://book.douban.com/subject_search?search_text={q}', category: '百科' },
  { name: '百度学术', baseUrl: 'https://xueshu.baidu.com', searchUrl: 'https://xueshu.baidu.com/s?wd={q}', category: '百科' },
  { name: '中国知网', baseUrl: 'https://www.cnki.net', searchUrl: 'https://search.cnki.net/Search/Result?theme={q}', category: '百科' },
  { name: '万方数据', baseUrl: 'https://www.wanfangdata.com.cn', searchUrl: 'https://www.wanfangdata.com.cn/?q={q}', category: '百科' },
  { name: '维普期刊', baseUrl: 'https://www.cqvip.com', searchUrl: 'https://www.cqvip.com/?q={q}', category: '百科' },

  // ============ 第二十八批：ctext 各部子类细分（站内搜索 endpoint）============
  { name: 'ctext-子部', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/zi-bu/zh?searchu={q}', category: '综合古籍' },
  { name: 'ctext-集部', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/ji-bu/zh?searchu={q}', category: '综合古籍' },
  { name: 'ctext-史部', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/shi-bu/zh?searchu={q}', category: '史书' },
  { name: 'ctext-经部', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/jing-bu/zh?searchu={q}', category: '经学' },
  { name: 'ctext-法家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/fa-jia/zh?searchu={q}', category: '法家' },
  { name: 'ctext-墨家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/mo-jia/zh?searchu={q}', category: '墨家' },
  { name: 'ctext-名家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/ming-jia/zh?searchu={q}', category: '诸子' },
  { name: 'ctext-兵家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/military/zh?searchu={q}', category: '兵家' },
  { name: 'ctext-小说', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/xiaoshuo/zh?searchu={q}', category: '古典文学' },
  { name: 'ctext-杂家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/za-jia/zh?searchu={q}', category: '诸子' },
  { name: 'ctext-纵横家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/zonghen-jia/zh?searchu={q}', category: '诸子' },
  { name: 'ctext-农家', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/nong-jia/zh?searchu={q}', category: '诸子' },
  { name: 'ctext-相宅相墓', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=90&searchu={q}', category: '风水' },
  { name: 'ctext-占卜', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=87&searchu={q}', category: '占卜' },
  { name: 'ctext-命书', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=92&searchu={q}', category: '命理' },
  { name: 'ctext-相书', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=91&searchu={q}', category: '相术' },
  { name: 'ctext-阴阳五行', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=88&searchu={q}', category: '术数' },
  { name: 'ctext-杂技术', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=93&searchu={q}', category: '术数' },
  { name: 'ctext-类书', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=95&searchu={q}', category: '综合古籍' },
  { name: 'ctext-医方', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=86&searchu={q}', category: '中医' },
  { name: 'ctext-本草', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=85&searchu={q}', category: '中医' },
  { name: 'ctext-针灸', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=82&searchu={q}', category: '中医' },
  { name: 'ctext-诊法', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=83&searchu={q}', category: '中医' },
  { name: 'ctext-易纬', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=72&searchu={q}', category: '易学' },
  { name: 'ctext-京房易', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=73&searchu={q}', category: '易学' },
  { name: 'ctext-邵雍', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=74&searchu={q}', category: '易学' },
  { name: 'ctext-焦氏易林', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/library.pl?if=gb&res=75&searchu={q}', category: '易学' },
  { name: 'ctext-礼记', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/liji/zh?searchu={q}', category: '经学' },
  { name: 'ctext-诗经', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/book-of-poetry/zh?searchu={q}', category: '经学' },
  { name: 'ctext-尚书', baseUrl: 'https://ctext.org', searchUrl: 'https://ctext.org/shang-shu/zh?searchu={q}', category: '经学' },

  // ============ 第二十九批：识典古籍 各分类 endpoint ============
  { name: '识典-经部全', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing?q={q}', category: '经学' },
  { name: '识典-史部全', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/shi?q={q}', category: '史书' },
  { name: '识典-子部全', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi?q={q}', category: '诸子' },
  { name: '识典-集部全', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/ji?q={q}', category: '古典文学' },
  { name: '识典-术数子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/shushu?q={q}', category: '术数' },
  { name: '识典-医家子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/yi?q={q}', category: '中医' },
  { name: '识典-道家子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/dao?q={q}', category: '道家' },
  { name: '识典-释家子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/shi?q={q}', category: '佛家' },
  { name: '识典-儒家子部', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/zi/ru?q={q}', category: '儒家' },
  { name: '识典-礼类', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/li?q={q}', category: '经学' },
  { name: '识典-诗类', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/shi?q={q}', category: '经学' },
  { name: '识典-书类', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/shu?q={q}', category: '经学' },
  { name: '识典-春秋类', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/chunqiu?q={q}', category: '经学' },
  { name: '识典-孝经类', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/xiaojing?q={q}', category: '经学' },
  { name: '识典-五经总义', baseUrl: 'https://www.shidianguji.com', searchUrl: 'https://www.shidianguji.com/category/jing/wujing?q={q}', category: '经学' },

  // ============ 第三十批：archive.org 各 collection endpoint ============
  { name: 'archive-chinese', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+collection%3Achinese-classics', category: '综合古籍' },
  { name: 'archive-buddhist', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+collection%3Abuddhist-canon', category: '佛家' },
  { name: 'archive-taoist', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+collection%3Adaozang', category: '道家' },
  { name: 'archive-tcm', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+collection%3Atraditional-chinese-medicine', category: '中医' },
  { name: 'archive-divination', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Adivination', category: '占卜' },
  { name: 'archive-yijing', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Ayijing', category: '易学' },
  { name: 'archive-fengshui', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Afeng-shui', category: '风水' },
  { name: 'archive-physiognomy', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Aphysiognomy', category: '相术' },
  { name: 'archive-ziwei', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Aziwei', category: '紫微斗数' },
  { name: 'archive-qimen', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Aqimen', category: '奇门遁甲' },
  { name: 'archive-liuren', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Aliuren', category: '大六壬' },
  { name: 'archive-meihua', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Ameihua', category: '梅花易数' },
  { name: 'archive-bazi', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Abazi', category: '八字' },
  { name: 'archive-mingli', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Achinese-astrology', category: '命理' },
  { name: 'archive-xingming', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3Aname-divination', category: '姓名学' },
  { name: 'archive-pdf', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+mediatype%3Atexts+AND+format%3APDF', category: '综合古籍' },
  { name: 'archive-djvu', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+format%3Adjvu', category: '综合古籍' },
  { name: 'archive-texts', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+mediatype%3Atexts', category: '综合古籍' },
  { name: 'archive-zh-language', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+language%3AChinese', category: '综合古籍' },
  { name: 'archive-classic', baseUrl: 'https://archive.org', searchUrl: 'https://archive.org/search.php?query={q}+AND+subject%3A%22Classical+Chinese%22', category: '经典原文' },

  // ============ 第三十一批：维基文库各分类 ============
  { name: '维基文库-经', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E7%B6%93%E9%83%A8?q={q}', category: '经学' },
  { name: '维基文库-史', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E5%8F%B2%E9%83%A8?q={q}', category: '史书' },
  { name: '维基文库-子', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E5%AD%90%E9%83%A8?q={q}', category: '诸子' },
  { name: '维基文库-集', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E9%9B%86%E9%83%A8?q={q}', category: '古典文学' },
  { name: '维基文库-道藏', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E9%81%93%E8%97%8F?q={q}', category: '道家' },
  { name: '维基文库-大藏经', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E5%A4%A7%E8%97%8F%E7%B6%93?q={q}', category: '佛家' },
  { name: '维基文库-术数', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E8%A1%93%E6%95%B8?q={q}', category: '术数' },
  { name: '维基文库-医家', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E9%86%AB%E5%AE%B6?q={q}', category: '中医' },
  { name: '维基文库-易类', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E6%98%93%E9%A1%9E?q={q}', category: '易学' },
  { name: '维基文库-儒家', baseUrl: 'https://zh.wikisource.org', searchUrl: 'https://zh.wikisource.org/wiki/Category:%E5%84%92%E5%AE%B6?q={q}', category: '儒家' },

  // ============ 第三十二批：国学梦深度分类（每个分类一个独立 endpoint）============
  { name: '国学梦-面相', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/mianxiang/?s={q}', category: '相术' },
  { name: '国学梦-手相', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/shouxiang/?s={q}', category: '相术' },
  { name: '国学梦-八字', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/bazi/?s={q}', category: '八字' },
  { name: '国学梦-梅花', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/meihua/?s={q}', category: '梅花易数' },
  { name: '国学梦-六爻', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/liuyao/?s={q}', category: '六爻' },
  { name: '国学梦-塔罗', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/taluo/?s={q}', category: '占卜' },
  { name: '国学梦-生肖', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/shengxiao/?s={q}', category: '命理' },
  { name: '国学梦-星座', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/xingzuo/?s={q}', category: '命理' },
  { name: '国学梦-黄历', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/huangli/?s={q}', category: '命理' },
  { name: '国学梦-测字', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/cezi/?s={q}', category: '姓名学' },
  { name: '国学梦-梦境', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/jiemeng/?s={q}', category: '占卜' },
  { name: '国学梦-佛家', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/fojia/?s={q}', category: '佛家' },
  { name: '国学梦-道家', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/daojia/?s={q}', category: '道家' },
  { name: '国学梦-儒家', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/rujia/?s={q}', category: '儒家' },
  { name: '国学梦-中医', baseUrl: 'https://www.guoxuemeng.com', searchUrl: 'https://www.guoxuemeng.com/zhongyi/?s={q}', category: '中医' },

  // ============ 第三十三批：殆知阁 / 中华典藏 分类 ============
  { name: '殆知阁-经部', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/经部?q={q}', category: '经学' },
  { name: '殆知阁-史部', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/史部?q={q}', category: '史书' },
  { name: '殆知阁-子部', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/子部?q={q}', category: '诸子' },
  { name: '殆知阁-集部', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/集部?q={q}', category: '古典文学' },
  { name: '殆知阁-道藏', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/道藏?q={q}', category: '道家' },
  { name: '殆知阁-佛藏', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/佛藏?q={q}', category: '佛家' },
  { name: '殆知阁-医藏', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/医藏?q={q}', category: '中医' },
  { name: '殆知阁-术数', baseUrl: 'https://www.daizhige.org', searchUrl: 'https://www.daizhige.org/子部/术数类?q={q}', category: '术数' },
  { name: '中华典藏-经部', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/jingbu/?q={q}', category: '经学' },
  { name: '中华典藏-史部', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/shibu/?q={q}', category: '史书' },
  { name: '中华典藏-子部', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/zibu/?q={q}', category: '诸子' },
  { name: '中华典藏-集部', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/jibu/?q={q}', category: '古典文学' },
  { name: '中华典藏-术数', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/shushu/?q={q}', category: '术数' },
  { name: '中华典藏-道家', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/daojia/?q={q}', category: '道家' },
  { name: '中华典藏-佛家', baseUrl: 'https://www.zhonghuadiancang.com', searchUrl: 'https://www.zhonghuadiancang.com/fojia/?q={q}', category: '佛家' },

  // ============ 第三十四批：海外华人 / 港台繁体古籍站 ============
  { name: '台湾国家图书馆', baseUrl: 'https://www.ncl.edu.tw', searchUrl: 'https://aleweb.ncl.edu.tw/F/?func=find-b&request={q}', category: '图书馆' },
  { name: '台湾故宫善本', baseUrl: 'https://rbk-doc.npm.edu.tw', searchUrl: 'https://rbk-doc.npm.edu.tw/Search?q={q}', category: '图书馆' },
  { name: '香港大学图书馆', baseUrl: 'https://lib.hku.hk', searchUrl: 'https://lib.hku.hk/searchall?q={q}', category: '图书馆' },
  { name: '香港中文大学', baseUrl: 'https://www.lib.cuhk.edu.hk', searchUrl: 'https://www.lib.cuhk.edu.hk/search?q={q}', category: '图书馆' },
  { name: '香港浸会大学', baseUrl: 'https://library.hkbu.edu.hk', searchUrl: 'https://library.hkbu.edu.hk/search?q={q}', category: '图书馆' },
  { name: '澳门大学图书馆', baseUrl: 'https://library.um.edu.mo', searchUrl: 'https://library.um.edu.mo/search?q={q}', category: '图书馆' },
  { name: '中研院汉籍', baseUrl: 'https://hanchi.ihp.sinica.edu.tw', searchUrl: 'https://hanchi.ihp.sinica.edu.tw/ihp/hanji?q={q}', category: '海外华人' },
  { name: '中研院数位典藏', baseUrl: 'https://newdarc.sinica.edu.tw', searchUrl: 'https://newdarc.sinica.edu.tw/search?q={q}', category: '海外华人' },
  { name: '台大图书馆古籍', baseUrl: 'https://tulips.ntu.edu.tw', searchUrl: 'https://tulips.ntu.edu.tw/search?q={q}', category: '海外华人' },
  { name: '台湾政大', baseUrl: 'https://thinker.lib.nccu.edu.tw', searchUrl: 'https://thinker.lib.nccu.edu.tw/search?q={q}', category: '海外华人' },

  // ============ 第三十五批：日韩汉学站 ============
  { name: '日本京都人文研', baseUrl: 'http://www.zinbun.kyoto-u.ac.jp', searchUrl: 'http://www.zinbun.kyoto-u.ac.jp/db/?q={q}', category: '海外图书馆' },
  { name: '日本国会图书馆', baseUrl: 'https://www.ndl.go.jp', searchUrl: 'https://iss.ndl.go.jp/api/opensearch?title={q}', category: '海外图书馆' },
  { name: '早稻田古籍', baseUrl: 'https://www.wul.waseda.ac.jp', searchUrl: 'https://www.wul.waseda.ac.jp/kotenseki/search?q={q}', category: '海外图书馆' },
  { name: '日本东洋文库', baseUrl: 'http://www.toyo-bunko.or.jp', searchUrl: 'http://www.toyo-bunko.or.jp/search?q={q}', category: '海外图书馆' },
  { name: '韩国国立中央图书馆', baseUrl: 'https://www.nl.go.kr', searchUrl: 'https://www.nl.go.kr/search?q={q}', category: '海外图书馆' },
  { name: '韩国奎章阁', baseUrl: 'https://kyu.snu.ac.kr', searchUrl: 'https://kyu.snu.ac.kr/search?q={q}', category: '海外图书馆' },
  { name: '韩国汉文Database', baseUrl: 'https://db.itkc.or.kr', searchUrl: 'https://db.itkc.or.kr/search?q={q}', category: '海外图书馆' },
  { name: 'Wisdomlib 印度学', baseUrl: 'https://www.wisdomlib.org', searchUrl: 'https://www.wisdomlib.org/search?q={q}', category: '海外图书馆' },

  // ============ 第三十六批：欧美汉学 / 学术机构 ============
  { name: '哈佛燕京', baseUrl: 'https://library.harvard.edu', searchUrl: 'https://library.harvard.edu/search?q={q}', category: '海外图书馆' },
  { name: '普林斯顿东亚', baseUrl: 'https://library.princeton.edu', searchUrl: 'https://library.princeton.edu/search?q={q}', category: '海外图书馆' },
  { name: '哥伦比亚东亚', baseUrl: 'https://library.columbia.edu', searchUrl: 'https://library.columbia.edu/search?q={q}', category: '海外图书馆' },
  { name: '耶鲁东亚', baseUrl: 'https://library.yale.edu', searchUrl: 'https://library.yale.edu/search?q={q}', category: '海外图书馆' },
  { name: '芝加哥东亚', baseUrl: 'https://www.lib.uchicago.edu', searchUrl: 'https://www.lib.uchicago.edu/search?q={q}', category: '海外图书馆' },
  { name: '密歇根亚洲', baseUrl: 'https://lib.umich.edu', searchUrl: 'https://search.lib.umich.edu/?q={q}', category: '海外图书馆' },
  { name: '柏林国家图书馆', baseUrl: 'https://staatsbibliothek-berlin.de', searchUrl: 'https://staatsbibliothek-berlin.de/search?q={q}', category: '海外图书馆' },
  { name: 'British Library', baseUrl: 'https://www.bl.uk', searchUrl: 'https://www.bl.uk/search?q={q}', category: '海外图书馆' },
  { name: '法国国家图书馆 Gallica', baseUrl: 'https://gallica.bnf.fr', searchUrl: 'https://gallica.bnf.fr/SRU?query={q}', category: '海外图书馆' },
  { name: 'WorldCat', baseUrl: 'https://www.worldcat.org', searchUrl: 'https://www.worldcat.org/search?q={q}', category: '海外图书馆' },

  // ============ 第三十七批：GitHub 古籍仓库（更多）============
  { name: 'GitHub-yijing', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=yijing+{q}&type=repositories', category: 'GitHub仓库' },
  { name: 'GitHub-bazi', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=bazi+{q}&type=repositories', category: 'GitHub仓库' },
  { name: 'GitHub-fengshui', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=fengshui+{q}&type=repositories', category: 'GitHub仓库' },
  { name: 'GitHub-tcm', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=tcm+{q}&type=repositories', category: 'GitHub仓库' },
  { name: 'GitHub-classics', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=chinese-classics+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-daoist', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=daoist+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-buddhist', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=buddhist+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-confucian', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=confucian+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-zhouyi', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=zhouyi+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-divination', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=divination+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-physiognomy', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=physiognomy+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-ziwei', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=ziwei+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-qimen', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=qimen+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-liuren', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=liuren+{q}&type=code', category: 'GitHub仓库' },
  { name: 'GitHub-meihua', baseUrl: 'https://github.com', searchUrl: 'https://github.com/search?q=meihua+{q}&type=code', category: 'GitHub仓库' },

  // ============ 第三十八批：道藏 / 佛藏 / 医藏 子库 endpoint ============
  { name: 'CBETA-T01', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/search?canon=T&q={q}', category: '佛家' },
  { name: 'CBETA-X', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/search?canon=X&q={q}', category: '佛家' },
  { name: 'CBETA-N', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/search?canon=N&q={q}', category: '佛家' },
  { name: 'CBETA-K', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/search?canon=K&q={q}', category: '佛家' },
  { name: 'CBETA-D', baseUrl: 'https://cbetaonline.dila.edu.tw', searchUrl: 'https://cbetaonline.dila.edu.tw/search?canon=D&q={q}', category: '佛家' },
  { name: '道藏-洞真部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/dongzhen?q={q}', category: '道家' },
  { name: '道藏-洞玄部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/dongxuan?q={q}', category: '道家' },
  { name: '道藏-洞神部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/dongshen?q={q}', category: '道家' },
  { name: '道藏-太玄部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/taixuan?q={q}', category: '道家' },
  { name: '道藏-太平部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/taiping?q={q}', category: '道家' },
  { name: '道藏-太清部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/taiqing?q={q}', category: '道家' },
  { name: '道藏-正一部', baseUrl: 'https://www.daoinfo.org', searchUrl: 'https://www.daoinfo.org/zhengyi?q={q}', category: '道家' },
  { name: '中医典籍-内经', baseUrl: 'https://www.zhongyibaike.com', searchUrl: 'https://www.zhongyibaike.com/neijing?q={q}', category: '中医' },
  { name: '中医典籍-伤寒', baseUrl: 'https://www.zhongyibaike.com', searchUrl: 'https://www.zhongyibaike.com/shanghan?q={q}', category: '中医' },
  { name: '中医典籍-金匮', baseUrl: 'https://www.zhongyibaike.com', searchUrl: 'https://www.zhongyibaike.com/jingui?q={q}', category: '中医' },
  { name: '中医典籍-本草', baseUrl: 'https://www.zhongyibaike.com', searchUrl: 'https://www.zhongyibaike.com/bencao?q={q}', category: '中医' },
  { name: '中医典籍-针灸', baseUrl: 'https://www.zhongyibaike.com', searchUrl: 'https://www.zhongyibaike.com/zhenjiu?q={q}', category: '中医' },

  // ============ 第三十九批：玄学专业站点（命理八字 endpoint 细分）============
  { name: '盲派论坛', baseUrl: 'http://www.mangpai.cn', searchUrl: 'http://www.mangpai.cn/search?q={q}', category: '八字' },
  { name: '子平命理网', baseUrl: 'http://www.ziping.com', searchUrl: 'http://www.ziping.com/search?q={q}', category: '命理' },
  { name: '滴天髓阐微论坛', baseUrl: 'http://www.ditianshui.com', searchUrl: 'http://www.ditianshui.com/search?q={q}', category: '命理' },
  { name: '穷通宝鉴论坛', baseUrl: 'http://www.qiongtong.com', searchUrl: 'http://www.qiongtong.com/search?q={q}', category: '命理' },
  { name: '三命通会-原文', baseUrl: 'http://www.sanming.com', searchUrl: 'http://www.sanming.com/search?q={q}', category: '命理' },
  { name: '神峰通考论坛', baseUrl: 'http://www.shenfeng.com', searchUrl: 'http://www.shenfeng.com/search?q={q}', category: '命理' },
  { name: '渊海子平-原文', baseUrl: 'http://www.yuanhai.com', searchUrl: 'http://www.yuanhai.com/search?q={q}', category: '命理' },
  { name: '紫微斗数论坛', baseUrl: 'http://www.ziweidoushu.com', searchUrl: 'http://www.ziweidoushu.com/search?q={q}', category: '紫微斗数' },
  { name: '中州派紫微', baseUrl: 'http://www.zhongzhoupai.com', searchUrl: 'http://www.zhongzhoupai.com/search?q={q}', category: '紫微斗数' },
  { name: '飞星紫微', baseUrl: 'http://www.feixing.com', searchUrl: 'http://www.feixing.com/search?q={q}', category: '紫微斗数' },
  { name: '奇门遁甲网', baseUrl: 'http://www.qimendunjia.com', searchUrl: 'http://www.qimendunjia.com/search?q={q}', category: '奇门遁甲' },
  { name: '大六壬网', baseUrl: 'http://www.daliuren.com', searchUrl: 'http://www.daliuren.com/search?q={q}', category: '大六壬' },
  { name: '梅花心易网', baseUrl: 'http://www.meihuayishu.com', searchUrl: 'http://www.meihuayishu.com/search?q={q}', category: '梅花易数' },
  { name: '六爻预测网', baseUrl: 'http://www.liuyao.com', searchUrl: 'http://www.liuyao.com/search?q={q}', category: '六爻' },
  { name: '金口诀网', baseUrl: 'http://www.jinkoujue.com', searchUrl: 'http://www.jinkoujue.com/search?q={q}', category: '术数' },

  // ============ 第四十批：风水 / 玄空 / 八宅 细分 ============
  { name: '玄空飞星网', baseUrl: 'http://www.xuankongfeixing.com', searchUrl: 'http://www.xuankongfeixing.com/search?q={q}', category: '风水' },
  { name: '八宅明镜网', baseUrl: 'http://www.bazhai.com', searchUrl: 'http://www.bazhai.com/search?q={q}', category: '风水' },
  { name: '三元玄空网', baseUrl: 'http://www.sanyuan.com', searchUrl: 'http://www.sanyuan.com/search?q={q}', category: '风水' },
  { name: '三合风水网', baseUrl: 'http://www.sanhefengshui.com', searchUrl: 'http://www.sanhefengshui.com/search?q={q}', category: '风水' },
  { name: '过路阴阳网', baseUrl: 'http://www.guoluyinyang.com', searchUrl: 'http://www.guoluyinyang.com/search?q={q}', category: '风水' },
  { name: '阳宅三要网', baseUrl: 'http://www.yangzhai.com', searchUrl: 'http://www.yangzhai.com/search?q={q}', category: '风水' },
  { name: '阴宅风水网', baseUrl: 'http://www.yinzhai.com', searchUrl: 'http://www.yinzhai.com/search?q={q}', category: '风水' },
  { name: '寻龙点穴网', baseUrl: 'http://www.xunlong.com', searchUrl: 'http://www.xunlong.com/search?q={q}', category: '风水' },
  { name: '罗经透解网', baseUrl: 'http://www.luojing.com', searchUrl: 'http://www.luojing.com/search?q={q}', category: '风水' },
  { name: '杨公风水网', baseUrl: 'http://www.yanggong.com', searchUrl: 'http://www.yanggong.com/search?q={q}', category: '风水' },

  // ============ 第四十一批：相术 / 面相 / 手相 细分 ============
  { name: '麻衣神相网', baseUrl: 'http://www.mayixiang.com', searchUrl: 'http://www.mayixiang.com/search?q={q}', category: '相术' },
  { name: '柳庄相法网', baseUrl: 'http://www.liuzhuang.com', searchUrl: 'http://www.liuzhuang.com/search?q={q}', category: '相术' },
  { name: '神相全编网', baseUrl: 'http://www.shenxiang.com', searchUrl: 'http://www.shenxiang.com/search?q={q}', category: '相术' },
  { name: '冰鉴论坛', baseUrl: 'http://www.bingjian.com', searchUrl: 'http://www.bingjian.com/search?q={q}', category: '相术' },
  { name: '水镜集网', baseUrl: 'http://www.shuijing.com', searchUrl: 'http://www.shuijing.com/search?q={q}', category: '相术' },
  { name: '手相图解网', baseUrl: 'http://www.shouxiang.com', searchUrl: 'http://www.shouxiang.com/search?q={q}', category: '相术' },
  { name: '面相图解网', baseUrl: 'http://www.mianxiang.com', searchUrl: 'http://www.mianxiang.com/search?q={q}', category: '相术' },
  { name: '掌纹研究网', baseUrl: 'http://www.zhangwen.com', searchUrl: 'http://www.zhangwen.com/search?q={q}', category: '相术' },

];

/**
 * 把搜索 URL 模板填入书名（自动 URL 编码）
 */
export function buildSearchUrl(template: string, bookName: string): string {
  return template.replace('{q}', encodeURIComponent(bookName));
}

/**
 * 获取所有数据源的实际搜索 URL（按书名生成）
 */
export function getAllSearchUrls(bookName: string): Array<{ name: string; url: string; category: string }> {
  return DATA_SOURCES.map((ds) => ({
    name: ds.name,
    url: buildSearchUrl(ds.searchUrl, bookName),
    category: ds.category,
  }));
}

/**
 * 按类别筛选数据源
 */
export function getSourcesByCategory(category: string): DataSource[] {
  return DATA_SOURCES.filter((ds) => ds.category === category);
}
