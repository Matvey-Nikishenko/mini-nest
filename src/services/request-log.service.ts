import { Injectable } from '../decorators/injectable.js';
import { getRequestId } from '../context/request-context.js';

@Injectable()
export class RequestLogService {
  currentId() {
    const requestId = getRequestId();
    return requestId;
  }
}
