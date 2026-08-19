export interface ZaloPhoneDataResponse {
  data: {
    number: string; // Format: 84...
  };
  error?: number;
  message?: string;
}

export interface ZaloProfileDataResponse {
  id?: string;
  name?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
  avatar?: string;
  error?: number;
  message?: string;
  data?: {
    id?: string;
    name?: string;
    displayName?: string;
    avatar?: string;
    avatarUrl?: string;
    picture?: {
      data?: {
        url?: string;
      };
    };
  };
}

export class ZaloProfileDto {
  phoneNumber?: string;
  zaloUserId?: string;
  fullName?: string;
  avatarUrl?: string;
}
