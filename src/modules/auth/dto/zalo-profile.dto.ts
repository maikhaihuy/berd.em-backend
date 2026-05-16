export interface ZaloPhoneDataResponse {
  data: {
    number: string; // Format: 84...
  };
  error?: number;
  message?: string;
}

export class ZaloProfileDto {
  phoneNumber!: string;
  zaloId?: string;
  fullName?: string;
  avatarUrl?: string;
}
