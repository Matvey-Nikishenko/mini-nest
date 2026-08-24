# mini-nest

IoC-контейнер і HTTP-шар на `reflect-metadata` + `node:http`. Частина 2 (гілка `part-2-http`).

```bash
npm install
npm test
docker compose run --rm api npm test
```

## Як це працює

TypeScript стирає типи в рантаймі. З `"experimentalDecorators"` і `"emitDecoratorMetadata"` компілятор кладе типи параметрів конструктора в метадані `design:paramtypes` — але тільки якщо на класі є хоч один декоратор (`@Injectable()`). Контейнер читає цей масив через `Reflect.getMetadata` і рекурсивно збирає залежності. Без `emitDecoratorMetadata` метаданих немає, резолвити нічого. Інтерфейси в масиві стають `Object`, тому для них потрібен `@Inject(token)`.

## Як параметр-декоратор знає, куди підставити значення

`@Body()`, `@Param(name)` і `@Query(name)` самі нічого не читають із запиту. Вони лише записують у метадані методу мапу `{ [index]: { type, name } }`, де `index` — позиція аргумента в сигнатурі. Диспетчер під час HTTP-виклику читає цю мапу, дістає body / `:id` / `?limit=` і збирає масив аргументів у правильному порядку. Метод контролера отримує вже готові значення і `req` не бачить.
