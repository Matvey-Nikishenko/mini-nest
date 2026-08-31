# mini-nest

IoC-контейнер, HTTP і повний життєвий цикл запиту. Частина 3 (гілка `part-3-lifecycle`).

```bash
npm install
npm test
docker compose run --rm api npm test
```

## Життєвий цикл запиту

```
Middleware → Guard → Interceptor (before) → Pipe → Handler
                  → Interceptor (after) → Exception Filter
```

`handle()` проходить ці стадії послідовно. Guard каже лише «пускати чи ні» і не бачить відповідь. Interceptor обгортає виклик: код до, `next()`, код після. Pipe змінює аргумент безпосередньо перед хендлером. Filter — зовнішній `try/catch`: будь-яка помилка (навіть з interceptor) стає HTTP-відповіддю.

## Як параметр-декоратор знає, куди підставити значення

`@Body()`, `@Param(name)` і `@Query(name)` самі нічого не читають із запиту. Вони записують мапу `{ [index]: { type, name } }`. Диспетчер під час виклику збирає аргументи за цією мапою.

## Чому AsyncLocalStorage, а не глобальна змінна

Поки один запит стоїть на `await`, event loop може взяти наступний і перезаписати глобал. Лог глибоко в сервісі тоді побачить чужий `requestId` — ту саму гонку, що на Лекції 2. `AsyncLocalStorage.run(store, callback)` обгортає весь обробник: після `await` Node відновлює саме той store, з якого вийшли. Тому `RequestLogService` читає id зі сховища, без параметра в сигнатурі, і той самий id повертається в `X-Request-Id`.
