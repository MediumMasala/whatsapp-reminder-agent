import { getPrismaClient } from '../config/database';
import { CreateUserInput } from '../types';
import { User } from '@prisma/client';

export class UserRepository {
  private prisma = getPrismaClient();

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        phoneNumber: input.phoneNumber,
        name: input.name,
        timezone: input.timezone,
      },
    });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Partial<CreateUserInput>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async findOrCreate(input: CreateUserInput): Promise<User> {
    let user = await this.findByPhoneNumber(input.phoneNumber);

    if (!user) {
      user = await this.create(input);
    }

    return user;
  }
}
