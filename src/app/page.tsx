import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Карточки для соцсетей без лишней рутины',
  description: 'Создавайте связанные серии текстовых карточек, оформляйте их в едином стиле и скачивайте готовые PNG или ZIP прямо в браузере.',
};

const features = [
  ['Текст → карточки с ИИ', 'Разбейте большой текст на связанную серию карточек, сохранив смысл и выбранный стиль подачи.'],
  ['90 готовых тем', 'Настройте формат, цвета, типографику и отдельные слова без работы в графическом редакторе.'],
  ['Чёткий PNG и ZIP', 'Скачивайте одну карточку или всю серию архивом в качестве, подходящем для публикации.'],
  ['Проекты и синхронизация', 'После регистрации храните независимые серии карточек и продолжайте работу на другом устройстве.'],
];

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
          <div className="welcome-demo-card welcome-demo-back" />
          <div className="welcome-demo-card welcome-demo-middle" />
          <article className="welcome-demo-card welcome-demo-front">
            <span>01 / 03</span>
            <h2>Одна карточка — одна законченная мысль</h2>
            <p>Сосредоточьтесь на содержании. Cardcraft поможет сохранить ритм и визуальную связность серии.</p>
            <div><i /><i /><i /></div>
          </article>
        </div>
      </section>

      <section className="welcome-section" aria-labelledby="featuresTitle">
        <span className="welcome-eyebrow">Возможности</span>
        <h2 id="featuresTitle">От исходного текста до готовой серии</h2>
        <div className="welcome-feature-grid">
          {features.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{description}</p>
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
          <article><span>1</span><div><h3>Соберите содержание</h3><p>Напишите карточки вручную или подготовьте черновик серии с ИИ.</p></div></article>
          <article><span>2</span><div><h3>Проверьте и оформите</h3><p>Отредактируйте каждую мысль, выберите формат и общую визуальную тему.</p></div></article>
          <article><span>3</span><div><h3>Экспортируйте</h3><p>Скачайте отдельный PNG, набор файлов или упорядоченный ZIP-архив.</p></div></article>
        </div>
      </section>

      <section className="welcome-principles">
        <article><strong>Без обязательной регистрации</strong><p>Ручной редактор и экспорт доступны сразу. Локальный черновик остаётся в текущем браузере.</p></article>
        <article><strong>ИИ не подменяет автора</strong><p>Вы выбираете режим обработки, роль и лимит текста, а затем просматриваете результат перед добавлением.</p></article>
        <article><strong>Проекты не смешиваются</strong><p>У каждой зарегистрированной серии — собственные карточки и настройки оформления.</p></article>
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
