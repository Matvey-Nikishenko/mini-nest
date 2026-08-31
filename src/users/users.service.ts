import { Injectable } from '../decorators/injectable.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';

@Injectable()
export class UsersService {
  lastCreated: CreateUserDto | null = null;

  create(dto: CreateUserDto) {
    this.lastCreated = dto;
    return { id: '1', name: dto.name, email: dto.email };
  }

  findOne(id: string) {
    return { id };
  }

  list(limit?: string) {
    return { limit };
  }
}
