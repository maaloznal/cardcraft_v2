import Link from 'next/link';
import type { Metadata } from 'next';
import WelcomeCarousel, { type CarouselCard } from './welcome-carousel';

export const metadata: Metadata = {
  title: 'Карточки для соцсетей без лишней рутины',
  description: 'Создавайте связанные серии текстовых карточек, оформляйте их в едином стиле и скачивайте готовые PNG или ZIP прямо в браузере.',
};

const heroCards: CarouselCard[] = [
  {
    index: '01 / 03',
    title: 'Одна карточка — одна законченная мысль',
    description: 'Сосредоточьтесь на содержании. Cardcraft поможет сохранить ритм и визуальную связность серии.',
  },
  {
    index: '02 / 03',
    title: '90 готовых тем оформления',
    description: 'Единый стиль серии без графического редактора: формат, цвета, типографика и стилизация отдельных слов.',
  },
  {
    index: '03 / 03',
    title: 'Чёткий PNG в любом разрешении',
    description: '760, 1140 или 1520 пикселей — результат одинаков на телефоне, планшете и компьютере.',
  },
];

const features = [
  {
    icon: 'ai',
    title: 'Текст → карточки с ИИ',
    description: 'Разбейте большой текст на связанную серию карточек, сохранив смысл и выбранный стиль подачи.',
  },
  {
    icon: 'palette',
    title: '90 готовых тем',
    description: 'Настройте формат, цвета, типографику и отдельные слова без работы в графическом редакторе.',
  },
  {
    icon: 'download',
    title: 'Чёткий PNG и ZIP',
    description: 'Скачивайте одну карточку или всю серию архивом в качестве, подходящем для публикации.',
  },
  {
    icon: 'sync',
    title: 'Проекты и синхронизация',
    description: 'После регистрации храните независимые серии карточек и продолжайте работу на другом устройстве.',
  },
];

const principles = [
  {
    icon: 'no-login',
    title: 'Без обязательной регистрации',
    description: 'Ручной редактор и экспорт доступны сразу. Локальный черновик остаётся в текущем браузере.',
  },
  {
    icon: 'author',
    title: 'ИИ не подменяет автора',
    description: 'Вы выбираете режим обработки, роль и лимит текста, а затем просматриваете результат перед добавлением.',
  },
  {
    icon: 'projects',
    title: 'Проекты не смешиваются',
    description: 'У каждой зарегистрированной серии — собственные карточки и настройки оформления.',
  },
];

const FeatureIcon = ({ name }: { name: string }) => {
  const icons: Record<string, React.ReactElement> = {
    ai: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    palette: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .9-1.8 2-1.8h2.5c2.5 0 4.5-2 4.5-4.5C22 5.9 17.5 2 12 2z" />
      </svg>
    ),
    download: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    sync: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16" />
        <path d="M21 21v-5h-5" />
      </svg>
    ),
    'no-login': (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    ),
    author: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    projects: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  };
  return icons[name] ?? null;
};

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <nav className="welcome-nav" aria-label="Основная навигация">
        <Link className="welcome-brand" href="/">Cardcraft</Link>
        <div>
          <Link href="/docs">Документация</Link>
          <Link href="/login">Войти</Link>
          <Link className="welcome-nav-primary" href="/editor">Открыть редактор</Link>
        </div>
      </nav>

      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <span className="welcome-eyebrow">Карточки для соцсетей без лишней рутины</span>
          <h1>Превращайте мысли в&nbsp;понятные визуальные истории</h1>
          <p>Cardcraft помогает собрать серию текстовых карточек, оформить её в едином стиле и скачать готовые изображения прямо в браузере.</p>
          <div className="welcome-actions">
            <Link className="welcome-primary" href="/editor">Начать без регистрации</Link>
            <Link className="welcome-secondary" href="/login?mode=signup&next=/editor">Создать аккаунт</Link>
          </div>
          <small>Редактор доступен сразу. Регистрация нужна только для ИИ, проектов и облачной синхронизации.</small>
        </div>

        <div className="welcome-demo" aria-label="Пример серии карточек">
          <WelcomeCarousel cards={heroCards} />
        </div>
      </section>

      <section className="welcome-section" aria-labelledby="featuresTitle">
        <span className="welcome-eyebrow">Возможности</span>
        <h2 id="featuresTitle">От исходного текста до готовой серии</h2>
        <div className="welcome-feature-grid">
          {features.map((feature, index) => (
            <article key={feature.title} className="welcome-feature-card">
              <div className="welcome-feature-icon">
                <FeatureIcon name={feature.icon} />
              </div>
              <span className="welcome-feature-num">{String(index + 1).padStart(2, '0')}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome-workflow" aria-labelledby="workflowTitle">
        <div className="welcome-workflow-heading">
          <span className="welcome-eyebrow">Понятный процесс</span>
          <h2 id="workflowTitle">Вы сохраняете контроль над каждой карточкой</h2>
          <p>Cardcraft не прячет результат за автоматизацией: содержимое, последовательность и оформление всегда можно проверить и изменить до скачивания.</p>
        </div>
        <div className="welcome-workflow-steps">
          <article className="welcome-workflow-step">
            <span className="welcome-workflow-num">1</span>
            <div><h3>Соберите содержание</h3><p>Напишите карточки вручную или подготовьте черновик серии с ИИ.</p></div>
          </article>
          <article className="welcome-workflow-step">
            <span className="welcome-workflow-num">2</span>
            <div><h3>Проверьте и оформите</h3><p>Отредактируйте каждую мысль, выберите формат и общую визуальную тему.</p></div>
          </article>
          <article className="welcome-workflow-step">
            <span className="welcome-workflow-num">3</span>
            <div><h3>Экспортируйте</h3><p>Скачайте отдельный PNG, набор файлов или упорядоченный ZIP-архив.</p></div>
          </article>
        </div>
      </section>

      <section className="welcome-principles" aria-labelledby="principlesTitle">
        <div className="welcome-principles-heading">
          <span className="welcome-eyebrow welcome-eyebrow-light">Преимущества</span>
          <h2 id="principlesTitle">Создано для вдумчивой работы</h2>
        </div>
        <div className="welcome-principles-grid">
          {principles.map((p) => (
            <article key={p.title} className="welcome-principle-card">
              <div className="welcome-principle-icon"><FeatureIcon name={p.icon} /></div>
              <strong>{p.title}</strong>
              <p>{p.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome-registration">
        <div>
          <span className="welcome-eyebrow">Бесплатный аккаунт</span>
          <h2>Работайте с сериями, а не с одним черновиком</h2>
          <p>Создавайте неограниченное количество проектов, переключайтесь между ними и храните карточки отдельно.</p>
        </div>
        <ul>
          <li><strong>50 000</strong><span>стартовых ИИ-токенов</span></li>
          <li><strong>∞</strong><span>проектов</span></li>
          <li><strong>1</strong><span>аккаунт на всех устройствах</span></li>
        </ul>
        <Link className="welcome-primary" href="/login?mode=signup&next=/editor">Зарегистрироваться</Link>
      </section>

      <footer className="welcome-footer">
        <span>Cardcraft</span>
        <p>Создавайте карточки, которые удобно читать.</p>
        <Link href="/docs">Как начать →</Link>
      </footer>
    </main>
  );
}
