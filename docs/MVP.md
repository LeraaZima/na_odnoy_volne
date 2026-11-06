# MVP scope — курс «Стартап-экосистемы»

## Why this product
Two friends (next to each other or in different cities) want to decide what to watch together. The MVP finds a common choice; it does not stream or synchronize playback.

## Current sprint — implemented in this starter
- [x] Guest name on entry (no account)
- [x] Room creation with a 6-character code
- [x] Join by room code on another browser/device
- [x] Live list of room participants via Socket.IO
- [x] Room cap = 2, expiration = 24 hours, PostgreSQL persistence
- [x] Responsive light/dark home and room interface
- [x] Ability to leave room
- [x] Docker Compose: сборка и запуск проверены на текущем компьютере с существующим томом PostgreSQL
- [x] Серверный каталог TMDB: миграции, исходный JSON, жанры, поиск по названию и фильтрация
- [x] Реальный импорт TMDB проверен с API Key: 58 фильмов, 19 жанров, повтор без дублей
- [x] Новая волна, светлая/тёмная темы, подсветка ввода и поддержка уменьшенного движения

## Next sprint — Codex task
- [x] Общие фильтры создателя: несколько жанров, годы, рейтинг, длительность; настроение не реализовано
- [x] Каталог TMDB в PostgreSQL; постеры загружаются с TMDB без копирования в репозиторий
- [x] Общая сохраняемая колода и просмотр карточек кнопками
- [x] Свайпы мышью и пальцем, кнопки и клавиатура; уникальные оценки в PostgreSQL
- [x] Серверный Match при двух лайках, транзакции, уникальность и событие `match:created`
- [x] Полноэкранный Match и сохраняемая история совпадений
- [x] API/Socket.IO-тесты, сценарий двух Chrome и инструкции README

## Demo acceptance criteria
1. Start via `docker compose up --build`.
2. Open `http://localhost:5173` in regular and incognito windows.
3. Enter names, create room in window A, join code in window B.
4. Both windows display two participants; a third attempt is rejected.
5. Refresh: same room remains visible.
6. Both like the same film and see a match; reload restores progress and match history.

## Important product and security boundaries
Guest auth via a random session token is suitable for **local course demonstration**, not production. Later add rate limits, secure hosting, token expiry/rotation, privacy and abuse protections, legal provider links, and production migration tooling. Don't expose the PostgreSQL port to the public Internet.
