/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { UploadsService } from './uploads.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { ConfigService } from '@nestjs/config';
import { FieldValidationException } from '@common/exceptions/field-validation.exception';

describe('UploadsService', () => {
  let prisma: {
    upload: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let r2Storage: { putObject: jest.Mock };
  let configService: { get: jest.Mock };
  let service: UploadsService;

  const buildFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      fieldname: 'files',
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake-image-bytes'),
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(() => {
    prisma = {
      upload: { create: jest.fn((args: any) => ({ id: 1, ...args.data })) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    r2Storage = {
      putObject: jest
        .fn()
        .mockResolvedValue('https://pub-dev.r2.dev/uploads/some-key.jpg'),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new UploadsService(
      prisma as unknown as PrismaService,
      r2Storage as unknown as R2StorageService,
      configService as unknown as ConfigService,
    );
  });

  describe('uploadFiles', () => {
    it('stores each file in R2 and creates an Upload row with the uploader id', async () => {
      const file = buildFile();

      const result = await service.uploadFiles([file], 42);

      expect(r2Storage.putObject).toHaveBeenCalledTimes(1);
      expect(prisma.upload.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.upload.create.mock.calls[0][0];
      expect(createArgs.data).toMatchObject({
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        uploadedByUserId: 42,
        createdBy: 42,
        updatedBy: 42,
      });
      expect(result).toEqual([
        {
          id: 1,
          url: 'https://pub-dev.r2.dev/uploads/some-key.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          createdAt: undefined,
        },
      ]);
    });

    it('rejects a disallowed mime type without storing anything', async () => {
      const file = buildFile({ mimetype: 'application/pdf' });

      await expect(service.uploadFiles([file], 42)).rejects.toThrow(
        FieldValidationException,
      );
      expect(r2Storage.putObject).not.toHaveBeenCalled();
      expect(prisma.upload.create).not.toHaveBeenCalled();
    });

    it('rejects an oversized file without storing anything', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'UPLOAD_MAX_FILE_SIZE_BYTES' ? '100' : undefined,
      );
      const file = buildFile({ size: 200 });

      await expect(service.uploadFiles([file], 42)).rejects.toThrow(
        FieldValidationException,
      );
      expect(r2Storage.putObject).not.toHaveBeenCalled();
      expect(prisma.upload.create).not.toHaveBeenCalled();
    });

    it('rejects a request with too many files without storing anything', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'UPLOAD_MAX_FILES_PER_REQUEST' ? '2' : undefined,
      );
      const files = [buildFile(), buildFile(), buildFile()];

      await expect(service.uploadFiles(files, 42)).rejects.toThrow(
        FieldValidationException,
      );
      expect(r2Storage.putObject).not.toHaveBeenCalled();
      expect(prisma.upload.create).not.toHaveBeenCalled();
    });

    it('rejects an empty file list', async () => {
      await expect(service.uploadFiles([], 42)).rejects.toThrow(
        FieldValidationException,
      );
      expect(r2Storage.putObject).not.toHaveBeenCalled();
    });
  });
});
