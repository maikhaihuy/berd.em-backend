import { Upload } from '@prisma/client';
import { UploadResponseDto } from './dto/upload-response.dto';

export class UploadMapper {
  static toDto(upload: Upload): UploadResponseDto {
    return {
      id: upload.id,
      url: upload.url,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      createdAt: upload.createdAt,
    };
  }

  static toDtos(uploads: Upload[]): UploadResponseDto[] {
    return uploads.map((upload) => UploadMapper.toDto(upload));
  }
}
