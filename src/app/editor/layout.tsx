import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Редактор карточек',
  description: 'Создавайте, оформляйте и скачивайте серии текстовых карточек.',
};

export default function EditorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
