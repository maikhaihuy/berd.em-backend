import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ZaloPhoneDataResponse, ZaloProfileDto } from './dto/zalo-profile.dto';

@Injectable()
export class ZaloAuthService {
  private readonly logger = new Logger(ZaloAuthService.name);
  private readonly zaloGraphApiUrl = 'https://graph.zalo.me/v2.0/me/info';

  constructor(private readonly configService: ConfigService) {}

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
        this.zaloGraphApiUrl,
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

  /**
   * Optionally retrieve additional profile information from Zalo
   * This can be extended based on available Zalo API endpoints
   */
  async getZaloProfile(accessToken: string): Promise<Partial<ZaloProfileDto>> {
    try {
      // This is a placeholder - adjust based on actual Zalo API endpoints available
      // You may need different endpoints for name, avatar, etc.
      this.logger.log('Retrieving Zalo profile information');

      // For now, return empty profile - extend this based on your Zalo API access
      return {};
    } catch (error) {
      this.logger.warn('Failed to retrieve Zalo profile information', error);
      // Non-critical - return empty profile
      return {};
    }
  }
}
