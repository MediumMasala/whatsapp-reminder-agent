import { UserRepository } from '../repositories/user.repository';
import { CreateUserInput } from '../types';
import { User } from '@prisma/client';
import { logger } from '../config/logger';

export class UserService {
  private repository: UserRepository;

  constructor(repository?: UserRepository) {
    this.repository = repository || new UserRepository();
  }

  async findOrCreateUser(phoneNumber: string, name?: string): Promise<User> {
    logger.info({ phoneNumber }, 'Finding or creating user');

    return this.repository.findOrCreate({
      phoneNumber,
      name,
    });
  }

  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    return this.repository.findByPhoneNumber(phoneNumber);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async updateUser(id: string, data: Partial<CreateUserInput>): Promise<User> {
    logger.info({ userId: id, data }, 'Updating user');
    return this.repository.update(id, data);
  }
}
