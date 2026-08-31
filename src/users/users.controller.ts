import { Controller } from '../decorators/controller.js';
import { Get, Post } from '../decorators/methods.js';
import { Body, Param, Query } from '../decorators/params.js';
import { UseGuards } from '../decorators/use-hooks.js';
import { CreateUserSchema, type CreateUserDto } from '../dto/create-user.dto.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(readonly users: UsersService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.users.list(limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body(CreateUserSchema) dto: CreateUserDto) {
    return this.users.create(dto);
  }
}
