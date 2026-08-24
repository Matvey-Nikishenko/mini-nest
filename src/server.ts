import 'reflect-metadata';
import { createApp } from './dispatcher.js';
import { UsersController } from './users/users.controller.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp([UsersController]);

const url = await app.listen(port);
console.log(`mini-nest listening on ${url}`);
