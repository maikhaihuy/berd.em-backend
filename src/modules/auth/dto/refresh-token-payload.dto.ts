export class RefreshTokenPayloadDto {
  sub!: number; // User ID
  typ?: 'refresh';
  sessionId?: string;
  empId?: number; // Employee ID (Quan trọng cho Staff/Manager)
  phone!: string; // Số điện thoại từ Zalo (Dùng thay cho email)
  roles!: string[]; // Mỗi User có thể giữ nhiều role cùng lúc (via UserRole)
  branches!: number[]; // Danh sách ID chi nhánh mà nhân viên làm việc
  managedBranches!: number[]; // Danh sách ID chi nhánh được phép quản lý (ManagerBranch)
  iat?: number; // Issued at
  exp?: number; // Expires at
  jti?: string; // JWT ID (for refresh tokens)
}
