import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AuthenticatedUserDto extends  {
  const user: ({
    employee: ({
        branches: {
            name: string;
            phone: string | null;
            email: string | null;
            address: string;
            id: number;
            createdAt: Date;
            createdBy: number;
            updatedAt: Date;
            updatedBy: number;
            abbreviation: string;
        }[];
    } & {
        name: string;
        phone: string;
        avatar: string | null;
        email: string | null;
        address: string | null;
        isActive: boolean;
        id: number;
        createdAt: Date;
        createdBy: number;
        updatedAt: Date;
        updatedBy: number;
    }) | null;
    roles: ({
        permissions: {
            description: string | null;
            id: number;
            createdAt: Date;
            createdBy: number;
            updatedAt: Date;
            updatedBy: number;
            action: string;
            subject: string;
        }[];
    } & {
        ...;
    })[];
} & {
    ...;
}) | null
}
