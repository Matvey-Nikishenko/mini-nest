import { Injectable } from '../decorators/injectable.js';
import type { CreateUserDto } from '../dto/create-user.dto.js';
import { RequestLogService } from '../services/request-log.service.js';

@Injectable()
export class UsersService {
  lastCreated: CreateUserDto | null = null;
  createCalls = 0;

  constructor(private readonly requestLog: RequestLogService) {}

  create(dto: CreateUserDto) {
    this.createCalls += 1;
    this.lastCreated = dto;
    return { id: '1', name: dto.name, email: dto.email };
  }

  findOne(id: string) {
    return { id, requestId: this.requestLog.currentId() };
  }

  list(limit?: string) {
    return { limit };
  }
}
