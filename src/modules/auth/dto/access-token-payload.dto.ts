export class AccessTokenPayloadDto {
  sub!: number; // User ID
  typ?: 'access';
  empId?: number; // Employee ID (Quan trọng cho Staff/Manager) Lần đầu tiên có thể null, sau đó sẽ được gán khi nhân viên được tạo
  phone!: string; // Số điện thoại từ Zalo (Dùng thay cho email)
  roles!: string[]; // Mỗi User có thể giữ nhiều role cùng lúc (via UserRole)
  branches!: number[]; // Danh sách ID chi nhánh mà nhân viên làm việc
  managedBranches!: number[]; // Danh sách ID chi nhánh được phép quản lý (ManagerBranch)
  iat?: number; // Issued at
  exp?: number; // Expires at
  jti?: string; // JWT ID (for refresh tokens)
}
