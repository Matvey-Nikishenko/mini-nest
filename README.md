# mini-nest

IoC-контейнер на `reflect-metadata`. Частина 1 (гілка `part-1-ioc`).

```bash
npm install
npm test
docker compose run --rm api npm test
```

## Як це працює

TypeScript стирає типи в рантаймі. З `"experimentalDecorators"` і `"emitDecoratorMetadata"` компілятор кладе типи параметрів конструктора в метадані `design:paramtypes` — але тільки якщо на класі є хоч один декоратор (`@Injectable()`). Контейнер читає цей масив через `Reflect.getMetadata` і рекурсивно збирає залежності. Без `emitDecoratorMetadata` метаданих немає, резолвити нічого. Інтерфейси в масиві стають `Object`, тому для них потрібен `@Inject(token)`.
