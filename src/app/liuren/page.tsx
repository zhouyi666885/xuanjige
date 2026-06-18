import { DivinationPage } from '@/components/divination-page';

export default function LiurenPage() {
  return (
    <DivinationPage
      type="liuren"
      icon="🌊"
      title="大六壬"
      subtitle="四课三传·金口诀"
      placeholder="请输入您要占问的事情，如：这笔投资能成吗？行人何时归？"
      systemInfo="大六壬为三式之一，最擅日常人事占断。以日辰起四课，推三传，配合天将神煞断吉凶。《六壬心镜》为唐代奠基，《六壬断案》为案例经典，《六壬指南》为明代扛鼎。金口诀为六壬简化版，适合快速断事。"
      classics={[
        '《六壬心镜》——徐道符（唐代奠基）★★★★★',
        '《六壬断案》——邵彦和（案例经典）★★★★★',
        '《六壬指南》——陈公献（明代扛鼎）★★★★★',
        '《六壬毕法赋》——凌福之（断法纲领）★★★★★',
        '《大六壬金口诀》——孙膑 ★★★★',
        '《大六壬大全》——郭御青 ★★★★',
      ]}
    />
  );
}
