# Дизайн на согласование: две волны

Изменения ограничены визуальной частью frontend. Backend, миграции, правила комнат и Match не менялись. Скриншоты сделаны на изолированных браузерных фикстурах: имена, код DESIGN и «Вечер у моря» — примеры для проверки интерфейса, не пользовательские данные. HTTP и Socket.IO перехвачены тестом; записи в PostgreSQL не выполнялись.

## Что изменено

- Удалён `.spinner` из строки приглашения. Это был декоративный индикатор ожидания без реального запроса. Правило `.member > span:not(.avatar)` растягивало его, превращая круг в овал, который вращался через `spin`.
- Добавлен спокойный блок «Ждём компанию» / «Компания собирается». Рядом остаются настоящие имена, аватары и статусы подключения. Статус не подразумевает голосование за готовность и не меняет условия старта раунда.
- Новый авторский SVG: встречные фиолетовый и голубой потоки, полупрозрачные внутренние слои и общий гребень. Без глаз, лица и внешних SVG-библиотек. Слои размечены `data-layer`.
- На главной движение ограничено несколькими пикселями. На Match соединение проигрывается один раз за 2,8 секунды; конечный символ остаётся неподвижным. При reduced-motion сразу показывается объединённая волна.

## Скриншоты

| Экран | 390, светлая | 390, тёмная | 1280, светлая | 1280, тёмная |
| --- | --- | --- | --- | --- |
| Главная | [PNG](screenshots/home-390-light.png) | [PNG](screenshots/home-390-dark.png) | [PNG](screenshots/home-1280-light.png) | [PNG](screenshots/home-1280-dark.png) |
| Комната | [PNG](screenshots/room-390-light.png) | [PNG](screenshots/room-390-dark.png) | [PNG](screenshots/room-1280-light.png) | [PNG](screenshots/room-1280-dark.png) |
| Match, соединение завершено | [PNG](screenshots/match-390-light.png) | [PNG](screenshots/match-390-dark.png) | [PNG](screenshots/match-1280-light.png) | [PNG](screenshots/match-1280-dark.png) |
| Match, начало соединения | [PNG](screenshots/match-390-light-joining.png) | [PNG](screenshots/match-390-dark-joining.png) | [PNG](screenshots/match-1280-light-joining.png) | [PNG](screenshots/match-1280-dark-joining.png) |

## Архив для возврата

Предыдущий символ: [wave-previous.svg](archive/wave-previous.svg). Точный исходный компонент: [WaveMascot.previous.jsx](archive/WaveMascot.previous.jsx), исходные стили: [styles.previous.css](archive/styles.previous.css).

Для возврата скопируйте архивный компонент в `frontend/src/components/WaveMascot.jsx` и восстановите его блок `.sea-wave`/`sea-*` из архивных стилей. Не заменяйте весь актуальный CSS: в нём могут быть последующие согласованные изменения. Архив не импортируется в приложение.

## Проверка

```bash
docker compose exec -T frontend npm run build
PLAYWRIGHT_MODULE=/tmp/wave-ui-check/node_modules/playwright-core/index.mjs node frontend/scripts/check-design.mjs
```

Сценарий проверяет три экрана × две ширины × две темы, отсутствие горизонтального переполнения и ошибок JS, удаление spinner, завершение соединения и отключение анимаций при reduced-motion. Он сохраняет 16 PNG. Требуются Chrome и playwright-core (установка описана в основном README). Скриншоты не заменяют согласование движения в живом браузере.
