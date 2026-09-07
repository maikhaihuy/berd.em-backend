import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@modules/auth/decorators/authenticated-user.decorator';
import { AuthenticatedUserDto } from '@modules/auth/dto/authenticated-user.dto';
import { UploadsService } from './uploads.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  AllowedUploadMimeType,
  DEFAULT_UPLOAD_MAX_FILES_PER_REQUEST,
  DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES,
} from './uploads.types';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @RequirePermissions({ action: 'create', subject: 'uploads' })
  @Post()
  @ApiOperation({ summary: 'Upload one or more image files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'The files have been successfully uploaded.',
    type: [UploadResponseDto],
  })
  @UseInterceptors(
    FilesInterceptor('files', DEFAULT_UPLOAD_MAX_FILES_PER_REQUEST, {
      storage: memoryStorage(),
      // A static, generous technical ceiling: NestJS evaluates this decorator
      // at module load, before ConfigService can read env-configured limits,
      // so the precise business limits (UPLOAD_MAX_FILE_SIZE_BYTES /
      // UPLOAD_MAX_FILES_PER_REQUEST) are enforced in UploadsService instead.
      // Raising those env vars above these defaults also requires raising
      // this ceiling.
      limits: { fileSize: DEFAULT_UPLOAD_MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (
          !ALLOWED_UPLOAD_MIME_TYPES.includes(
            file.mimetype as AllowedUploadMimeType,
          )
        ) {
          callback(
            new BadRequestException(`Unsupported file type: ${file.mimetype}.`),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @AuthenticatedUser() currentUser: AuthenticatedUserDto,
  ): Promise<UploadResponseDto[]> {
    return await this.uploadsService.uploadFiles(files, currentUser.userId);
  }
}
