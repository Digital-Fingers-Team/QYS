import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const adminEmail = 'admin@example.com';
  const hash = await bcrypt.hash('admin12345', 10);
  await prisma.user.upsert({ where: { email: adminEmail }, update: {}, create: { name: 'System Admin', email: adminEmail, passwordHash: hash, role: 'ADMIN' } });
  await prisma.center.createMany({ data: [
    { name: 'Benha Youth Center', location: 'Benha', type: 'Youth Center', description: 'Main center', rating: 4.5 },
    { name: 'Qalyub Sports Club', location: 'Qalyub', type: 'Sports Club', description: 'Club center', rating: 4.2 }
  ], skipDuplicates: true });
}
main().finally(()=>prisma.$disconnect());
