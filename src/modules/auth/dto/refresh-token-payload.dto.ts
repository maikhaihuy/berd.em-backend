export class RefreshTokenPayloadDto {
  sub!: number; // User ID
  empId?: number; // Employee ID (Quan trọng cho Staff/Manager)
  phone!: string; // Số điện thoại từ Zalo (Dùng thay cho email)
  role!: string; // Trong Spec 1.5, mỗi User thường chỉ có 1 role chính (ADMIN/MANAGER/STAFF)
  branches!: number[]; // Danh sách ID chi nhánh được phép quản lý/làm việc
  iat?: number; // Issued at
  exp?: number; // Expires at
  jti?: string; // JWT ID (for refresh tokens)
}
