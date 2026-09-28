import Link from 'next/link';
import type { Metadata } from 'next';
import DocsToc from './docs-toc';

export const metadata: Metadata = {
  title: 'Документация',
  description: 'Понятное руководство по редактору Cardcraft, проектам, созданию карточек с ИИ, дизайну, синхронизации и скачиванию.',
};

const steps = [
  ['Откройте редактор', 'Регистрация для ручного создания и скачивания карточек не требуется.'],
  ['Добавьте содержание', 'Заполните только нужные поля. Пустые разделы не занимают место в готовой карточке.'],
  ['Настройте оформление', 'Выберите формат публикации, тему, цвета, шрифты и качество экспорта.'],
  ['Проверьте и скачайте', 'Просмотрите всю последовательность и скачайте одну карточку, PNG-набор или ZIP.'],
];

const sections: [string, string][] = [
  ['quick-start', 'Быстрый старт'],
  ['editor', 'Редактор карточек'],
  ['projects', 'Проекты'],
  ['ai', 'Создание с ИИ'],
  ['design', 'Дизайн и форматы'],
  ['export', 'Скачивание'],
  ['storage', 'Хранение и синхронизация'],
  ['mobile', 'Телефон и планшет'],
  ['faq', 'Частые вопросы'],
];

export default function DocsPage() {
  return (
    <main className="docs-page">
      <nav className="welcome-nav" aria-label="Навигация документации">
        <Link className="welcome-brand" href="/">Cardcraft</Link>
        <div className="welcome-nav-links">
          <Link className="welcome-nav-link" href="/">О проекте</Link>
          <Link className="welcome-nav-cta" href="/editor">Открыть редактор</Link>
        </div>
      </nav>

      <div className="docs-layout">
        <DocsToc sections={sections} />

        <article className="docs-content">
          <header className="docs-header">
            <span className="welcome-eyebrow">Документация</span>
            <h1>Как работать в Cardcraft</h1>
            <p>От первого черновика до готовой серии: здесь собраны основные сценарии, ограничения и ответы на вопросы.</p>
            <div className="docs-status-row"><span>Без установки</span><span>Работает на телефоне</span><span>Автосохранение</span></div>
          </header>

          <section className="docs-block" id="quick-start">
            <div className="docs-section-heading"><span>01</span><div><h2>Быстрый старт</h2><p>Минимальный путь до первой готовой карточки.</p></div></div>
            <ol className="docs-steps">
              {steps.map(([title, description], index) => (
                <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>
              ))}
            </ol>
          </section>

          <section className="docs-block" id="editor">
            <div className="docs-section-heading"><span>02</span><div><h2>Редактор карточек</h2><p>Содержание редактируется отдельно от внешнего вида.</p></div></div>
            <div className="docs-grid">
              <article><h3>Поля карточки</h3><p>Доступны заголовок, подзаголовок, основной текст, список, итог и кнопка действия. Заполнять все поля необязательно.</p></article>
              <article><h3>Порядок серии</h3><p>Карточки можно добавлять, клонировать, перемещать и удалять. Нумерация пересчитывается автоматически.</p></article>
              <article><h3>Свёрнутый режим</h3><p>Заполненные карточки сворачиваются, чтобы длинную серию было проще просматривать и редактировать.</p></article>
              <article><h3>Отмена действий</h3><p>Кнопки отмены и повтора находятся сверху. Также работают сочетания Ctrl+Z и Ctrl+Y.</p></article>
            </div>
            <div className="docs-tip"><strong>Совет</strong><p>Одна карточка лучше читается, когда содержит одну законченную мысль, а не целую главу текста.</p></div>
          </section>

          <section className="docs-block" id="projects">
            <div className="docs-section-heading"><span>03</span><div><h2>Проекты</h2><p>Независимые рабочие пространства для разных серий.</p></div></div>
            <p>Редактор можно открыть без проекта — в этом случае вы работаете в локальном черновике. Создание облачных проектов доступно после регистрации, их количество не ограничено.</p>
            <ul className="docs-list">
              <li>Нажмите название текущего проекта в верхней панели.</li>
              <li>Первым пунктом находится кнопка «Новый проект».</li>
              <li>Ниже отображаются пять последних проектов.</li>
              <li>Кнопка «Ещё» раскрывает полный список.</li>
              <li>Переименование и удаление доступны в личном кабинете.</li>
            </ul>
            <div className="docs-warning"><strong>Важно</strong><p>Локальный черновик хранится только в текущем браузере. Для работы с одной серией на разных устройствах создайте проект.</p></div>
          </section>

          <section className="docs-block" id="ai">
            <div className="docs-section-heading"><span>04</span><div><h2>Создание с ИИ</h2><p>Инструмент для структурирования вашего текста, а не генератор случайного содержания.</p></div></div>
            <p>Функция доступна зарегистрированным пользователям. В один запрос можно передать до 10 000 символов, выбрать профессиональную роль и указать целевой объём одной карточки от 180 до 2 200 символов.</p>
            <div className="docs-compare">
              <article><span>Режим 1</span><h3>Не изменять текст</h3><p>Сохраняет порядок, стиль и формулировки. Исправляет орфографию, грамматику и пунктуацию, затем распределяет текст по карточкам.</p></article>
              <article><span>Режим 2</span><h3>Улучшить текст</h3><p>Дополнительно улучшает связность и читаемость, не добавляя новые факты, обещания и выводы.</p></article>
            </div>
            <p>ИИ сначала показывает предварительный результат. Карточки попадут в редактор только после вашего подтверждения.</p>
            <div className="docs-tip"><strong>Токены</strong><p>После регистрации начисляется 50 000 токенов. Фактический расход списывается сервером и отображается в личном кабинете.</p></div>
          </section>

          <section className="docs-block" id="design">
            <div className="docs-section-heading"><span>05</span><div><h2>Дизайн и форматы</h2><p>Один набор настроек применяется ко всей серии.</p></div></div>
            <ul className="docs-list">
              <li><strong>Формат:</strong> стандартный, 4:5, Stories 9:16 и варианты для популярных социальных сетей.</li>
              <li><strong>Тема:</strong> готовые сочетания фона, типографики и декоративных элементов.</li>
              <li><strong>Текст:</strong> отдельные слова и разделы можно выделять начертанием, цветом и размером.</li>
              <li><strong>Навигация:</strong> доступны номера карточек и индикатор прогресса.</li>
            </ul>
          </section>

          <section className="docs-block" id="export">
            <div className="docs-section-heading"><span>06</span><div><h2>Скачивание</h2><p>Выберите способ экспорта под конкретную задачу.</p></div></div>
            <div className="docs-grid docs-grid-three">
              <article><h3>Одна карточка</h3><p>Кнопка скачивания под превью создаёт PNG только для выбранной карточки.</p></article>
              <article><h3>PNG по одному</h3><p>«Скачать все» может сохранить каждую карточку отдельным изображением.</p></article>
              <article><h3>ZIP-архив</h3><p>Весь набор сохраняется одним архивом с файлами в правильном порядке.</p></article>
            </div>
            <p>Качество ×2, ×3 или ×4 задаётся в разделе «Дизайн». Для большинства публикаций оптимален режим ×3.</p>
          </section>

          <section className="docs-block" id="storage">
            <div className="docs-section-heading"><span>07</span><div><h2>Хранение и синхронизация</h2><p>Что происходит с вашей работой после закрытия страницы.</p></div></div>
            <div className="docs-table" role="table" aria-label="Сравнение способов хранения">
              <div role="row"><strong role="columnheader">Режим</strong><strong role="columnheader">Где хранится</strong><strong role="columnheader">Другое устройство</strong></div>
              <div role="row"><span role="cell">Локальный черновик</span><span role="cell">В браузере</span><span role="cell">Недоступен</span></div>
              <div role="row"><span role="cell">Проект</span><span role="cell">В Supabase</span><span role="cell">Синхронизируется</span></div>
            </div>
            <p>Карточки сохраняются автоматически. Перед переключением проекта текущие изменения отправляются в облако, поэтому серии не смешиваются.</p>
          </section>

          <section className="docs-block" id="mobile">
            <div className="docs-section-heading"><span>08</span><div><h2>Телефон и планшет</h2><p>Интерфейс меняется под размер экрана.</p></div></div>
            <p>На телефоне редактор и просмотр открываются как отдельные режимы. Переключатель остаётся сверху, а из превью можно сразу перейти к редактированию нужной карточки. На планшете используется сфокусированный режим либо разделённый экран — в зависимости от ширины.</p>
            <p>Cardcraft можно установить на домашний экран как PWA, если браузер поддерживает установку веб-приложений.</p>
          </section>

          <section className="docs-block" id="faq">
            <div className="docs-section-heading"><span>09</span><div><h2>Частые вопросы</h2><p>Короткие ответы на важные ситуации.</p></div></div>
            <div className="docs-faq">
              <details><summary>Можно ли пользоваться без регистрации?</summary><p>Да. Ручное создание, оформление и скачивание доступны в локальном черновике.</p></details>
              <details><summary>Почему черновика нет на другом устройстве?</summary><p>Локальный черновик не отправляется в облако. Создайте проект после регистрации, чтобы включить синхронизацию.</p></details>
              <details><summary>ИИ сразу изменяет мои карточки?</summary><p>Нет. Сначала показывается предварительный результат, который нужно подтвердить.</p></details>
              <details><summary>Можно ли создавать много проектов?</summary><p>Да, количество проектов для зарегистрированного пользователя не ограничено.</p></details>
              <details><summary>Как получить максимально чёткие изображения?</summary><p>Выберите качество ×3 или ×4. Учитывайте, что ×4 создаёт более тяжёлые файлы и требует больше памяти устройства.</p></details>
            </div>
          </section>

          <footer className="docs-actions">
            <Link className="welcome-primary" href="/editor">Перейти в редактор</Link>
            <Link className="welcome-secondary" href="/login?mode=signup&next=/editor">Создать аккаунт</Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
