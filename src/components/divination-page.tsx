'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BirthInfoForm, BirthInfo } from '@/components/birth-info-form';
import { PredictionFeedback } from '@/components/prediction-feedback';
import Link from 'next/link';

// ---- 各术数专用表单 ----

/** 六爻起卦方式 */
function LiuyaoForm({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gold/70 mb-1 block">占事类别</label>
        <select value={value.category || ''} onChange={e => update('category', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">请选择</option>
          <option value="求财">求财</option>
          <option value="婚姻">婚姻</option>
          <option value="事业">事业</option>
          <option value="出行">出行</option>
          <option value="官讼">官讼</option>
          <option value="疾病">疾病</option>
          <option value="考试">考试</option>
          <option value="行人">行人</option>
          <option value="失物">失物</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gold/70 mb-1 block">起卦方式</label>
        <select value={value.method || ''} onChange={e => update('method', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">请选择</option>
          <option value="铜钱摇卦">铜钱摇卦（手动记录）</option>
          <option value="时间起卦">时间起卦（以当前时辰起卦）</option>
          <option value="数字起卦">数字起卦（输入两个数字）</option>
        </select>
      </div>
      {value.method === '铜钱摇卦' && (
        <div>
          <label className="text-xs text-gold/70 mb-1 block">六次摇卦结果（每次三个铜钱，记录背/字）</label>
          <Textarea value={value.coins || ''} onChange={e => update('coins', e.target.value)}
            placeholder="示例：第一爻：背背字（阳爻）&#10;第二爻：字字字（阴爻）&#10;第三爻：背字背（阳爻）&#10;第四爻：字字背（阴爻）&#10;第五爻：背字字（阴爻）&#10;第六爻：背背背（老阳变爻）"
            className="min-h-[120px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground text-xs" rows={6} />
        </div>
      )}
      {value.method === '数字起卦' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gold/70 mb-1 block">第一个数</label>
            <input type="number" value={value.num1 || ''} onChange={e => update('num1', e.target.value)}
              className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="任意数字" />
          </div>
          <div>
            <label className="text-xs text-gold/70 mb-1 block">第二个数</label>
            <input type="number" value={value.num2 || ''} onChange={e => update('num2', e.target.value)}
              className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="任意数字" />
          </div>
        </div>
      )}
    </div>
  );
}

/** 梅花易数起卦 */
function MeihuaForm({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gold/70 mb-1 block">起卦方式</label>
        <select value={value.method || ''} onChange={e => update('method', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">请选择</option>
          <option value="时间起卦">时间起卦（以当前时辰自动起卦）</option>
          <option value="数字起卦">数字起卦（输入两个数字）</option>
          <option value="字起卦">字起卦（输入一个或两个字）</option>
          <option value="外应起卦">外应起卦（描述所见所闻）</option>
        </select>
      </div>
      {value.method === '数字起卦' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gold/70 mb-1 block">第一个数</label>
            <input type="number" value={value.num1 || ''} onChange={e => update('num1', e.target.value)}
              className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="任意数字" />
          </div>
          <div>
            <label className="text-xs text-gold/70 mb-1 block">第二个数</label>
            <input type="number" value={value.num2 || ''} onChange={e => update('num2', e.target.value)}
              className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="任意数字" />
          </div>
        </div>
      )}
      {value.method === '字起卦' && (
        <div>
          <label className="text-xs text-gold/70 mb-1 block">输入字</label>
          <input type="text" value={value.chars || ''} onChange={e => update('chars', e.target.value)}
            className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="输入一个或两个字" />
        </div>
      )}
      {value.method === '外应起卦' && (
        <div>
          <label className="text-xs text-gold/70 mb-1 block">描述你看到/听到的事物</label>
          <Textarea value={value.waiying || ''} onChange={e => update('waiying', e.target.value)}
            placeholder="例如：看到一只黑色的鸟从东边飞过..."
            className="min-h-[80px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground text-xs" rows={3} />
        </div>
      )}
      <div>
        <label className="text-xs text-gold/70 mb-1 block">所问之事</label>
        <input type="text" value={value.question || ''} onChange={e => update('question', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="简述你想占问的事" />
      </div>
    </div>
  );
}

/** 奇门遁甲 / 大六壬 占事时间 */
function QimenLiurenForm({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gold/70 mb-1 block">占事时间</label>
        <div className="grid grid-cols-4 gap-2">
          <input type="number" value={value.year || ''} onChange={e => update('year', e.target.value)}
            className="bg-ink border border-gold/20 rounded-lg px-2 py-2 text-sm text-foreground" placeholder="年" min={1900} max={2100} />
          <input type="number" value={value.month || ''} onChange={e => update('month', e.target.value)}
            className="bg-ink border border-gold/20 rounded-lg px-2 py-2 text-sm text-foreground" placeholder="月" min={1} max={12} />
          <input type="number" value={value.day || ''} onChange={e => update('day', e.target.value)}
            className="bg-ink border border-gold/20 rounded-lg px-2 py-2 text-sm text-foreground" placeholder="日" min={1} max={31} />
          <select value={value.hour || ''} onChange={e => update('hour', e.target.value)}
            className="bg-ink border border-gold/20 rounded-lg px-2 py-2 text-sm text-foreground">
            <option value="">时辰</option>
            <option value="子时(23-1)">子时(23-1)</option>
            <option value="丑时(1-3)">丑时(1-3)</option>
            <option value="寅时(3-5)">寅时(3-5)</option>
            <option value="卯时(5-7)">卯时(5-7)</option>
            <option value="辰时(7-9)">辰时(7-9)</option>
            <option value="巳时(9-11)">巳时(9-11)</option>
            <option value="午时(11-13)">午时(11-13)</option>
            <option value="未时(13-15)">未时(13-15)</option>
            <option value="申时(15-17)">申时(15-17)</option>
            <option value="酉时(17-19)">酉时(17-19)</option>
            <option value="戌时(19-21)">戌时(19-21)</option>
            <option value="亥时(21-23)">亥时(21-23)</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">不填则使用当前时间起局</p>
      </div>
      <div>
        <label className="text-xs text-gold/70 mb-1 block">所问之事</label>
        <input type="text" value={value.question || ''} onChange={e => update('question', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="简述你想占问的事" />
      </div>
    </div>
  );
}

/** 风水地理专用 */
function FengshuiForm({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gold/70 mb-1 block">宅类型</label>
        <select value={value.houseType || ''} onChange={e => update('houseType', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">请选择</option>
          <option value="阳宅">阳宅（住宅/商铺/办公）</option>
          <option value="阴宅">阴宅（墓地/祠堂）</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gold/70 mb-1 block">建造/入住年份</label>
          <input type="number" value={value.buildYear || ''} onChange={e => update('buildYear', e.target.value)}
            className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="如 2010" min={1900} max={2100} />
        </div>
        <div>
          <label className="text-xs text-gold/70 mb-1 block">朝向</label>
          <select value={value.facing || ''} onChange={e => update('facing', e.target.value)}
            className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
            <option value="">请选择</option>
            <option value="坐北朝南">坐北朝南</option>
            <option value="坐南朝北">坐南朝北</option>
            <option value="坐东朝西">坐东朝西</option>
            <option value="坐西朝东">坐西朝东</option>
            <option value="坐东北朝西南">坐东北朝西南</option>
            <option value="坐西南朝东北">坐西南朝东北</option>
            <option value="坐西北朝东南">坐西北朝东南</option>
            <option value="坐东南朝西北">坐东南朝西北</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gold/70 mb-1 block">详细描述</label>
        <Textarea value={value.description || ''} onChange={e => update('description', e.target.value)}
          placeholder="描述房屋周围环境、内部布局、具体问题等..."
          className="min-h-[80px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground text-xs" rows={3} />
      </div>
    </div>
  );
}

/** 姓名测算专用 */
function XingmingForm({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gold/70 mb-1 block">姓名</label>
        <input type="text" value={value.name || ''} onChange={e => update('name', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="请输入姓名" />
      </div>
      <div>
        <label className="text-xs text-gold/70 mb-1 block">性别</label>
        <select value={value.gender || ''} onChange={e => update('gender', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground">
          <option value="">请选择</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gold/70 mb-1 block">出生年份（可选，更精准）</label>
        <input type="number" value={value.birthYear || ''} onChange={e => update('birthYear', e.target.value)}
          className="w-full bg-ink border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground" placeholder="如 1990" min={1900} max={2100} />
      </div>
    </div>
  );
}

// ---- 主组件 ----

export type FormType = 'birth' | 'liuyao' | 'meihua' | 'qimen' | 'fengshui' | 'xingming';

interface DivinationPageProps {
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  placeholder: string;
  systemInfo: string;
  classics: string[];
  formType: FormType;
}

export function DivinationPage({ type, icon, title, subtitle, placeholder, systemInfo, classics, formType }: DivinationPageProps) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'casual' | 'professional'>('casual');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  // Birth info form (for bazi/ziwei)
  const [birthInfo, setBirthInfo] = useState<BirthInfo>({
    year: '', month: '', day: '', hour: '', minute: '', gender: '',
    province: '', city: '', district: '',
  });

  // Custom form data (for liuyao/meihua/qimen/fengshui/xingming)
  const [customData, setCustomData] = useState<Record<string, string>>({});

  const buildInputText = useCallback(() => {
    let text = '';

    if (formType === 'birth') {
      const parts: string[] = [];
      if (birthInfo.gender) parts.push(`性别：${birthInfo.gender === 'male' ? '男' : '女'}`);
      if (birthInfo.year && birthInfo.month && birthInfo.day) {
        let dateStr = `出生日期：${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日`;
        if (birthInfo.hour) dateStr += ` ${birthInfo.hour}时`;
        if (birthInfo.minute) dateStr += `${birthInfo.minute}分`;
        parts.push(dateStr);
      }
      if (birthInfo.province) {
        let locStr = `出生地：${birthInfo.province}`;
        if (birthInfo.city) locStr += ` ${birthInfo.city}`;
        if (birthInfo.district) locStr += ` ${birthInfo.district}`;
        parts.push(locStr);
      }
      text = parts.join('，');
      if (input.trim()) {
        text += (text ? '。' : '') + input.trim();
      }
    } else if (formType === 'liuyao') {
      const parts: string[] = [];
      if (customData.category) parts.push(`占事类别：${customData.category}`);
      if (customData.method) parts.push(`起卦方式：${customData.method}`);
      if (customData.method === '铜钱摇卦' && customData.coins) parts.push(`摇卦结果：${customData.coins}`);
      if (customData.method === '数字起卦' && customData.num1 && customData.num2) parts.push(`数字：${customData.num1}、${customData.num2}`);
      if (input.trim()) parts.push(`补充说明：${input.trim()}`);
      text = parts.join('。');
    } else if (formType === 'meihua') {
      const parts: string[] = [];
      if (customData.method) parts.push(`起卦方式：${customData.method}`);
      if (customData.method === '数字起卦' && customData.num1 && customData.num2) parts.push(`数字：${customData.num1}、${customData.num2}`);
      if (customData.method === '字起卦' && customData.chars) parts.push(`输入字：${customData.chars}`);
      if (customData.method === '外应起卦' && customData.waiying) parts.push(`外应：${customData.waiying}`);
      if (customData.question) parts.push(`所问之事：${customData.question}`);
      if (input.trim()) parts.push(`补充：${input.trim()}`);
      text = parts.join('。');
    } else if (formType === 'qimen') {
      const parts: string[] = [];
      if (customData.year || customData.month || customData.day || customData.hour) {
        parts.push(`占事时间：${customData.year || '？'}年${customData.month || '？'}月${customData.day || '？'}日 ${customData.hour || '当前时辰'}`);
      }
      if (customData.question) parts.push(`所问之事：${customData.question}`);
      if (input.trim()) parts.push(`补充：${input.trim()}`);
      text = parts.join('。');
    } else if (formType === 'fengshui') {
      const parts: string[] = [];
      if (customData.houseType) parts.push(`宅类型：${customData.houseType}`);
      if (customData.buildYear) parts.push(`建造年份：${customData.buildYear}年`);
      if (customData.facing) parts.push(`朝向：${customData.facing}`);
      if (customData.description) parts.push(`描述：${customData.description}`);
      if (input.trim()) parts.push(`补充：${input.trim()}`);
      text = parts.join('。');
    } else if (formType === 'xingming') {
      const parts: string[] = [];
      if (customData.name) parts.push(`姓名：${customData.name}`);
      if (customData.gender) parts.push(`性别：${customData.gender}`);
      if (customData.birthYear) parts.push(`出生年份：${customData.birthYear}年`);
      if (input.trim()) parts.push(`补充：${input.trim()}`);
      text = parts.join('。');
    }

    return text || input.trim();
  }, [formType, birthInfo, customData, input]);

  const handleSubmit = useCallback(async () => {
    const text = buildInputText();
    if (!text || loading) return;
    setLoading(true);
    setResult('');
    setError('');

    try {
      const body: Record<string, unknown> = {
        type,
        input: text,
        mode,
      };

      if (formType === 'birth') {
        body.birthInfo = {
          gender: birthInfo.gender === 'male' ? '男' : birthInfo.gender === 'female' ? '女' : undefined,
          birthYear: birthInfo.year ? parseInt(birthInfo.year) : undefined,
          birthMonth: birthInfo.month ? parseInt(birthInfo.month) : undefined,
          birthDay: birthInfo.day ? parseInt(birthInfo.day) : undefined,
          birthHour: birthInfo.hour ? parseInt(birthInfo.hour) : undefined,
          birthMinute: birthInfo.minute ? parseInt(birthInfo.minute) : undefined,
          province: birthInfo.province || undefined,
          city: birthInfo.city || undefined,
          district: birthInfo.district || undefined,
        };
      }

      const response = await fetch('/api/divination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setResult(accumulated);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Divination error:', err);
      setError('测算出错，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [buildInputText, loading, type, mode, formType, birthInfo]);

  const getCanSubmit = () => {
    if (formType === 'birth') {
      return (birthInfo.year && birthInfo.month && birthInfo.day && birthInfo.gender) || input.trim();
    }
    if (formType === 'liuyao') {
      return customData.method || input.trim();
    }
    if (formType === 'meihua') {
      return customData.method || input.trim();
    }
    if (formType === 'qimen') {
      return customData.question || input.trim();
    }
    if (formType === 'fengshui') {
      return customData.houseType || customData.description || input.trim();
    }
    if (formType === 'xingming') {
      return customData.name || input.trim();
    }
    return input.trim();
  };

  const renderForm = () => {
    if (formType === 'birth') {
      return <BirthInfoForm value={birthInfo} onChange={(info: BirthInfo | null) => setBirthInfo(info ?? birthInfo)} />;
    }
    if (formType === 'liuyao') {
      return <LiuyaoForm value={customData} onChange={setCustomData} />;
    }
    if (formType === 'meihua') {
      return <MeihuaForm value={customData} onChange={setCustomData} />;
    }
    if (formType === 'qimen') {
      return <QimenLiurenForm value={customData} onChange={setCustomData} />;
    }
    if (formType === 'fengshui') {
      return <FengshuiForm value={customData} onChange={setCustomData} />;
    }
    if (formType === 'xingming') {
      return <XingmingForm value={customData} onChange={setCustomData} />;
    }
    return null;
  };

  const formLabel = formType === 'birth' ? '出生信息' 
    : formType === 'liuyao' ? '起卦信息'
    : formType === 'meihua' ? '起卦信息'
    : formType === 'qimen' ? '占事信息'
    : formType === 'fengshui' ? '宅居信息'
    : '基本信息';

  const formIcon = formType === 'birth' ? '📋' 
    : formType === 'liuyao' ? '🪙'
    : formType === 'meihua' ? '🌸'
    : formType === 'qimen' ? '⏰'
    : formType === 'fengshui' ? '🏠'
    : '✍️';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink/95 backdrop-blur-md border-b border-gold/10">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <Link href="/" className="text-gold/50 hover:text-gold text-lg">←</Link>
          <div className="text-2xl">{icon}</div>
          <div>
            <h1 className="text-gold font-serif font-bold text-lg">{title}</h1>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className={mode === 'casual' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
            白话解读
          </span>
          <button
            onClick={() => setMode(prev => prev === 'casual' ? 'professional' : 'casual')}
            className="relative w-12 h-6 bg-ink rounded-full border border-gold/30 transition-colors"
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-gold transition-all duration-300 ${
              mode === 'professional' ? 'left-6' : 'left-0.5'
            }`} />
          </button>
          <span className={mode === 'professional' ? 'text-gold font-semibold' : 'text-muted-foreground'}>
            专业解读
          </span>
        </div>

        {/* Form (collapsible) */}
        <div className="bg-card border border-gold/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-gold">{formIcon}</span>
              <span className="text-gold font-serif text-sm font-bold">{formLabel}</span>
              {!showForm && (
                <span className="text-xs text-gold/50">（点击展开）</span>
              )}
            </div>
            <span className={`text-gold/50 transition-transform ${showForm ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showForm && (
            <div className="px-4 pb-4">
              {renderForm()}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] bg-ink border-gold/20 text-foreground placeholder:text-muted-foreground"
            rows={4}
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !getCanSubmit()}
            className="w-full bg-gold text-ink hover:bg-gold/90 font-semibold"
            size="lg"
          >
            {loading ? '解读中...' : '✨ 开始解读'}
          </Button>
        </div>

        {/* System Info */}
        <div className="bg-card border border-gold/10 rounded-xl p-4">
          <h3 className="text-gold font-serif text-sm font-bold mb-2">体系介绍</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">{systemInfo}</p>
        </div>

        {/* Result */}
        {(result || error) && (
          <div className="bg-card border border-gold/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gold">✦</span>
              <h3 className="text-gold font-serif font-bold">解读结果</h3>
            </div>
            {error && <p className="text-vermilion text-sm">{error}</p>}
            {result && (
              <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {result}
                {loading && <span className="typewriter-cursor" />}
              </div>
            )}
            {/* Feedback after streaming completes */}
            {!loading && result && (
              <PredictionFeedback
                divinationType={type}
                predictionSummary={result.slice(0, 500)}
              />
            )}
          </div>
        )}

        {/* Related Classics */}
        <div className="bg-card border border-gold/10 rounded-xl p-4">
          <h3 className="text-gold font-serif text-sm font-bold mb-3">相关经典</h3>
          <div className="space-y-2">
            {classics.map((c, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-gold/50 mt-0.5">◆</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
