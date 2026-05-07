const UserService = require('../services/UserService');
const { registerSchema, loginSchema } = require('../validators/userValidator');

class AuthController {
  // Registro
  async register(req, res, next) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await UserService.register(value);

      res.status(201).json({
        message: 'Usuario registrado exitosamente',
        data: result,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Login
  async login(req, res, next) {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await UserService.login(value.email, value.password);

      res.status(200).json({
        message: 'Login exitoso',
        data: result,
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  // Obtener perfil
  async getProfile(req, res, next) {
    try {
      const user = await UserService.getProfile(req.user.userId);

      res.status(200).json({
        data: user,
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // Actualizar perfil
  async updateProfile(req, res, next) {
    try {
      const { name, email } = req.body;

      const user = await UserService.updateProfile(req.user.userId, {
        name,
        email,
      });

      res.status(200).json({
        message: 'Perfil actualizado',
        data: user,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AuthController();
