import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: 'New password must be at least 8 characters long',
  })
  @MaxLength(72, {
    message: 'New password must not exceed 72 characters',
  })
  newPassword: string;
}
