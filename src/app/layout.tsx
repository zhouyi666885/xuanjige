import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '玄机阁 - 知命改运',
    template: '%s | 玄机阁',
  },
  description: '万卷玄典，知命改运。面相手相、八字命理、紫微斗数、奇门遁甲、六爻占卜、风水地理，引经据典，AI 解读。',
  keywords: [
    '算命',
    '面相',
    '手相',
    '八字',
    '紫微斗数',
    '奇门遁甲',
    '六爻',
    '风水',
    '梅花易数',
    '玄学',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a1a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
