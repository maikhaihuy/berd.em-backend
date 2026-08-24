import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { LoggerService } from '../logger/logger.service';

interface ResponseBody {
  statusCode: number;
  message: string;
  source: string;
  details?: unknown;
  errors?: Record<string, string[]>;
  timestamp: string;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let jsonMock: jest.Mock<void, [ResponseBody]>;
  let statusMock: jest.Mock;

  const buildHost = (): ArgumentsHost => {
    jsonMock = jest.fn<void, [ResponseBody]>();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    return {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/test', method: 'POST', body: {} }),
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  };

  const getResponseBody = (): ResponseBody => jsonMock.mock.calls[0][0];

  beforeEach(() => {
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as LoggerService;
    filter = new GlobalExceptionFilter(logger);
  });

  it('passes through a structured errors map already present on a 400 body unchanged', () => {
    const exception = new BadRequestException({
      message: 'Validation failed',
      errors: { email: ['Email is required.', 'Email format is invalid.'] },
    });

    filter.catch(exception, buildHost());

    const body = getResponseBody();
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.errors).toEqual({
      email: ['Email is required.', 'Email format is invalid.'],
    });
  });

  it('synthesizes errors._general for a 400 thrown with only a plain message', () => {
    const exception = new BadRequestException(
      'Start time must be before end time',
    );

    filter.catch(exception, buildHost());

    const body = getResponseBody();
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Start time must be before end time');
    expect(body.errors).toEqual({
      _general: ['Start time must be before end time'],
    });
  });

  it('does not add an errors key for a non-400 response (e.g. 403)', () => {
    const exception = new ForbiddenException('Forbidden');

    filter.catch(exception, buildHost());

    const body = getResponseBody();
    expect(body.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(body).not.toHaveProperty('errors');
  });

  it('does not add an errors key for a 404', () => {
    const exception = new NotFoundException('Not found');

    filter.catch(exception, buildHost());

    const body = getResponseBody();
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body).not.toHaveProperty('errors');
  });

  it('keeps statusCode, message, source, details, timestamp computation unchanged', () => {
    const exception = new BadRequestException({
      message: 'Bad input',
      source: 'CustomSource',
      details: { foo: 'bar' },
    });

    filter.catch(exception, buildHost());

    const body = getResponseBody();
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Bad input');
    expect(body.source).toBe('CustomSource');
    expect(body.details).toEqual({ foo: 'bar' });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
