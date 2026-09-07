import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@modules/prisma/prisma.service';
import { FieldValidationException } from '@common/exceptions/field-validation.exception';
import { R2StorageService } from './r2-storage.service';
import { UploadMapper } from './uploads.mapper';
import { UploadResponseDto } from './dto/upload-response.dto';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  AllowedUploadMimeType,
  DEFAULT_UPLOAD_MAX_FILES_PER_REQUEST,
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
  MIME_TYPE_EXTENSIONS,
} from './uploads.types';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
    private readonly configService: ConfigService,
  ) {}

  getMaxFileSizeBytes(): number {
    const raw = this.configService.get<string>('UPLOAD_MAX_FILE_SIZE_BYTES');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES;
  }

  getMaxFilesPerRequest(): number {
    const raw = this.configService.get<string>('UPLOAD_MAX_FILES_PER_REQUEST');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_UPLOAD_MAX_FILES_PER_REQUEST;
  }

  async uploadFiles(
    files: Express.Multer.File[],
    currentUserId: number,
  ): Promise<UploadResponseDto[]> {
    this.validateFiles(files);

    const stored = await Promise.all(files.map((file) => this.storeFile(file)));

    const uploads = await this.prisma.$transaction(
      stored.map(({ key, url, file }) =>
        this.prisma.upload.create({
          data: {
            key,
            url,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedByUserId: currentUserId,
            createdBy: currentUserId,
            updatedBy: currentUserId,
          },
        }),
      ),
    );

    return UploadMapper.toDtos(uploads);
  }

  private validateFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new FieldValidationException(
        'files',
        'At least one file is required.',
      );
    }

    const maxFiles = this.getMaxFilesPerRequest();
    if (files.length > maxFiles) {
      throw new FieldValidationException(
        'files',
        `A single request may contain at most ${maxFiles} file(s).`,
      );
    }

    const maxBytes = this.getMaxFileSizeBytes();
    for (const file of files) {
      if (
        !ALLOWED_UPLOAD_MIME_TYPES.includes(
          file.mimetype as AllowedUploadMimeType,
        )
      ) {
        throw new FieldValidationException(
          'files',
          `Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_UPLOAD_MIME_TYPES.join(', ')}.`,
        );
      }
      if (file.size > maxBytes) {
        throw new FieldValidationException(
          'files',
          `File "${file.originalname}" exceeds the maximum allowed size of ${maxBytes} bytes.`,
        );
      }
    }
  }

  private async storeFile(
    file: Express.Multer.File,
  ): Promise<{ key: string; url: string; file: Express.Multer.File }> {
    const extension =
      MIME_TYPE_EXTENSIONS[file.mimetype as AllowedUploadMimeType];
    const key = `uploads/${uuidv4()}${extension}`;
    const url = await this.r2Storage.putObject(key, file.buffer, file.mimetype);
    return { key, url, file };
  }
}
