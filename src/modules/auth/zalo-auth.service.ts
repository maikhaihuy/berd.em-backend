import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  ZaloPhoneDataResponse,
  ZaloProfileDataResponse,
  ZaloProfileDto,
} from './dto/zalo-profile.dto';

@Injectable()
export class ZaloAuthService {
  private readonly logger = new Logger(ZaloAuthService.name);
  private readonly zaloProfileApiUrl = 'https://graph.zalo.me/v2.0/me';
  private readonly zaloPhoneApiUrl = 'https://graph.zalo.me/v2.0/me/info';

  constructor(private readonly configService: ConfigService) {}

  async verifyAccessToken(accessToken: string): Promise<ZaloProfileDto> {
    try {
      this.logger.log('Calling Zalo Graph API to verify access token');

      const response = await axios.get<ZaloProfileDataResponse>(
        this.zaloProfileApiUrl,
        {
          headers: {
            access_token: accessToken,
          },
          params: {
            fields: 'id,name,picture',
          },
        },
      );

      const profileData = response.data;

      if (profileData.error) {
        this.logger.error(
          `Zalo profile API error: ${profileData.message || 'Failed to retrieve profile'}`,
        );
        throw new UnauthorizedException('Invalid Zalo access token');
      }

      const data = profileData.data;
      const zaloUserId = profileData.id ?? data?.id;

      if (!zaloUserId) {
        this.logger.error('Zalo profile response did not include a user ID');
        throw new UnauthorizedException('Invalid Zalo access token');
      }

      return {
        zaloUserId,
        fullName: profileData.name ?? data?.name ?? data?.displayName,
        avatarUrl:
          profileData.picture?.data?.url ??
          data?.picture?.data?.url ??
          profileData.avatar ??
          data?.avatarUrl ??
          data?.avatar,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Zalo profile API request failed: ${axiosError.message}`,
          axiosError.response?.data,
        );

        if ([400, 401, 403].includes(axiosError.response?.status ?? 0)) {
          throw new UnauthorizedException('Invalid Zalo access token');
        }
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Unexpected error verifying Zalo access token', error);
      throw new UnauthorizedException(
        'Failed to authenticate with Zalo. Please try again.',
      );
    }
  }

  /**
   * Decrypt and retrieve phone number from Zalo using access token and phone token
   * @param accessToken - From getAccessToken() on Zalo Mini App
   * @param phoneToken - From getPhoneNumber() on Zalo Mini App
   * @returns Zalo profile with decrypted phone number
   */
  async getPhoneNumber(
    accessToken: string,
    phoneToken: string,
  ): Promise<ZaloProfileDto> {
    const zaloAppSecret = this.configService.get<string>('ZALO_APP_SECRET');

    if (!zaloAppSecret) {
      this.logger.error('ZALO_APP_SECRET not configured in environment');
      throw new UnauthorizedException(
        'Zalo authentication is not properly configured',
      );
    }

    try {
      this.logger.log('Calling Zalo Graph API to decrypt phone number');

      const response = await axios.get<ZaloPhoneDataResponse>(
        this.zaloPhoneApiUrl,
        {
          headers: {
            access_token: accessToken,
            code: phoneToken,
            secret_key: zaloAppSecret,
          },
        },
      );

      const phoneData = response.data;

      // Check for error response from Zalo
      if (phoneData.error || !phoneData.data || !phoneData.data.number) {
        this.logger.error(
          `Zalo API error: ${phoneData.message || 'Failed to retrieve phone number'}`,
        );
        throw new UnauthorizedException(
          'Failed to retrieve phone number from Zalo',
        );
      }

      const phoneNumber = phoneData.data.number;

      this.logger.log(`Successfully retrieved phone number from Zalo`);

      return {
        phoneNumber,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Zalo API request failed: ${axiosError.message}`,
          axiosError.response?.data,
        );

        if (axiosError.response?.status === 401) {
          throw new UnauthorizedException('Invalid Zalo access token');
        }

        if (axiosError.response?.status === 400) {
          throw new UnauthorizedException('Invalid Zalo phone token or code');
        }
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Unexpected error during Zalo authentication', error);
      throw new UnauthorizedException(
        'Failed to authenticate with Zalo. Please try again.',
      );
    }
  }

  getZaloProfile(accessToken: string): Promise<ZaloProfileDto> {
    return this.verifyAccessToken(accessToken);
  }
}
