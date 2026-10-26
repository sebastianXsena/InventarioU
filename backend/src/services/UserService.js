const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepo');

class UserService {
  async register({ full_name, email, password, role = 'student', faculty_id, program_id, semester }) {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepo.create({ full_name, email, passwordHash, role, faculty_id, program_id, semester });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return { user, token };
  }

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, faculty_id: user.faculty_id, program_id: user.program_id, semester: user.semester },
    };
  }

  async getProfile(id) {
    const user = await userRepo.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }

  async getAllUsers() {
    return userRepo.findAll();
  }

  async updateProfile(id, data) {
    const updatedUser = await userRepo.updateProfile(id, data);
    if (!updatedUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return updatedUser;
  }

  async changePassword(id, oldPassword, newPassword) {
    const user = await userRepo.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const userWithHash = await userRepo.findByEmail(user.email);

    const valid = await bcrypt.compare(oldPassword, userWithHash.password_hash);
    if (!valid) {
      const err = new Error('Incorrect current password');
      err.statusCode = 400;
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(id, newHash);
    return { success: true };
  }

  async forgotPassword(email) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      const err = new Error('El correo electrónico no se encuentra registrado');
      err.statusCode = 404;
      throw err;
    }

    // Generate temporary 8-character password
    const tempPassword = Math.random().toString(36).substring(2, 10);
    const hash = await bcrypt.hash(tempPassword, 10);
    await userRepo.updatePassword(user.id, hash);

    return {
      message: 'Contraseña restablecida exitosamente',
      tempPassword
    };
  }
}

module.exports = new UserService();
