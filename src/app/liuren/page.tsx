import { DivinationPage } from '@/components/divination-page';

export default function LiurenPage() {
  return (
    <DivinationPage
      type="liuren"
      icon="🐉"
      title="大六壬"
      subtitle="四课三传·金口诀"
      placeholder="请描述您想占问的事情，以及当前时间。大六壬为三式之一，最擅日常人事占断，一事一课，精准断事。"
      systemInfo="大六壬为「三式」之一，与奇门、太乙并列。以日辰天将排四课三传，配十二天将、神煞断事。《六壬心镜》为唐代奠基，《六壬断案》为案例经典，《六壬指南》为明代扛鼎。金口诀为六壬简化版，适合速断。六壬最擅求财、婚姻、行人、官讼、疾病等日常占断。"
      classics={[
        '《六壬心镜》——徐道符（唐代奠基）★★★★★',
        '《六壬断案》——邵彦和（案例经典）★★★★★',
        '《六壬指南》——陈公献（明代扛鼎）★★★★★',
        '《六壬毕法赋》——凌福之（断法纲领）★★★★★',
        '《大六壬金口诀》——孙膑 ★★★★',
      ]}
    />
  );
}
