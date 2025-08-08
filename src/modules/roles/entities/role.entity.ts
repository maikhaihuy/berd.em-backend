export class RoleEntity {
  id: number;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
  // Relations
  // users       User[] @relation("UserRoles")
  // permissions Permission[] @relation("RolePermissions")
}
