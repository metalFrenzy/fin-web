import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/common/enum/user-role.enum';


export class SignupDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;

    @IsEnum(UserRole, { message: 'Role must be either "user" or "merchant"' })
    role: UserRole;
}