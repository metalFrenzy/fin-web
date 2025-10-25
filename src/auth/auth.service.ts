import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) { }

  async signup(signupDto: SignupDto) {
    const { email, password, role } = signupDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Use transaction to ensure user and wallet are created together
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        role,
      });

      const savedUser = await queryRunner.manager.save(user);

      // Create wallet for the user
      const wallet = this.walletRepository.create({
        userId: savedUser.id,
        balance: 0,
      });

      await queryRunner.manager.save(wallet);

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = this.generateToken(savedUser);

      return {
        message: 'User registered successfully',
        user: {
          id: savedUser.id,
          email: savedUser.email,
          role: savedUser.role,
        },
        token,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user with password (normally excluded)
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}