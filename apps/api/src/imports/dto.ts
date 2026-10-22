import { IsString, IsUUID, MaxLength } from 'class-validator';

export class PreviewImportDto {
  @IsString()
  @MaxLength(4000)
  mapping: string;
}

export class ConfirmImportDto {
  @IsUUID()
  previewId: string;
}
