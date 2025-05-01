module.exports = {
    jwtExpire:process.env.JWT_EXPIRE,
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    adminEmail: 'admin@gmail.com',
    adminPassword: 'Admin@123',
    tokenExpiration: '24h',
  };