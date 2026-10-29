# Компаньон (отдельно от SillyTavern, v1.0)

Компаньон работает сам по себе: маленький сервер на Node.js отдаёт страницу и хранит данные и картинки в папке `data/`. С SillyTavern он больше не связан: ничего не добавляет в промпт и не читает чат. Ставится на тот же сервер, где стоит ST (Node.js там уже есть), открывается в браузере по своему адресу с паролем.

## Установка на сервер
Все команды выполняются на сервере по SSH.

1. Скачать код (для приватного репозитория ссылка с токеном, см. ниже):
   ```
   git clone https://<токен>@github.com/l3525999/silly_companion ~/companion
   cd ~/companion
   ```
2. Перенести данные и картинки из ST, который запущен в Docker (контейнер `sillytavern`):
   ```
   mkdir -p data/import
   docker cp sillytavern:/home/node/app/data/default-user/user/files/companion-db.json data/import/
   docker cp sillytavern:/home/node/app/data/default-user/user/images/companion data/import/images
   docker run --rm -v ~/companion:/app -w /app node:22-alpine node server.js import data/import/companion-db.json data/import/images
   ```
   Команда напишет, сколько сценариев, девушек, дней и картинок перенесено. Можно перенести и из файла переноса с claude.ai: положить его в `data/import/` и указать вместо `companion-db.json`.
3. Запустить насовсем (поднимается сам после перезагрузки), придумав пароль:
   ```
   docker run -d --name companion --restart unless-stopped -p 8787:8787 -e COMPANION_HOST=0.0.0.0 -e COMPANION_PASSWORD=придумайте -v ~/companion:/app -w /app node:22-alpine node server.js
   ```
   Открыть `http://<адрес сервера>:8787/`, браузер спросит логин (любой) и пароль. Если порт закрыт, его нужно открыть в настройках хостинга или файрвола.
4. В ST удалить расширение Companion: «Расширения → Manage extensions → Companion → удалить». Старые данные в ST остаются на месте и больше не используются.

Без Docker: на сервере нужен Node.js 18 или новее, команды те же без `docker run … node:22-alpine`, например `COMPANION_HOST=0.0.0.0 COMPANION_PASSWORD=… node server.js`.

### Обновление
```
cd ~/companion && git pull && docker restart companion
```

### Настройки
| Переменная | По умолчанию | Что задаёт |
| --- | --- | --- |
| `COMPANION_PORT` | 8787 | порт |
| `COMPANION_HOST` | 127.0.0.1 | 0.0.0.0, чтобы открывать с других устройств; тогда пароль обязателен |
| `COMPANION_PASSWORD` | нет | пароль на вход |
| `COMPANION_DATA` | `./data` | папка с данными |

Пароль по обычному `http://` передаётся без шифрования. Если у ST есть домен с HTTPS (nginx или похожий), компаньон лучше открыть через него же, например по пути `/companion/`: страница работает и из подпапки.

### Ссылка для приватного репозитория
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token: доступ только к `silly_companion`, Repository permissions → Contents: Read-only. Токен никому не показывать и не присылать в чат.

## Данные
- `data/db.json`: все сценарии, девушки, журнал и пресеты.
- `data/backups/db-ГГГГ-ММ-ДД.json`: копия за каждый день, хранятся последние 30. Перед переносом прежние данные сохраняются в `db-before-import-….json`.
- `data/images/`: картинки.
- Папка `data/` не попадает в Git. Для резервной копии достаточно скопировать её целиком.

## Что есть
- Весь компаньон: Игра и Мастерская, как было на claude.ai.
- Мини-режим: адрес с `#mini` на конце (или кнопка ◧ в правом нижнем углу) показывает дежурных дня: фигуру без фона, рост, вес, BWH, Cup, фазу, дежурства. Удобно держать узким окном рядом с ST. Клик по карточке открывает медкарту, ⤢ возвращает полный вид.
- Сценарий типа «Клуб» (Мастерская → Настройки сценария → Тип игры): до трёх героев, вкладка «Клуб» с доской набора девушек (не знает · слышала · интересуется · вступила · против), индекс клуба 0–100 с пятью уровнями и событиями, кнопка «Для ST» копирует запись для Lorebook. В мини-режиме клуба видны девушки, которыми занимается кто-то из героев.
- Посты Slutify, которые расширение раньше сохранило из чата, остаются видны в окне дня. Новые больше не появляются.

## Сборка (для Claude)
`python3 tools/build.py <путь к companion/src/index.html>` пересобирает `companion.html`: подменяет хранилище на своё (tools/shim.html), добавляет мини-режим и просмотр постов (tools/api.js, tools/companion.css). `server.js` без зависимостей, нужен Node.js 18 или новее.
