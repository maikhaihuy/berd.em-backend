// import { prisma } from '@/lib/prisma';

// const initialBranches = [
//   {
//     name: 'Soli 62 Tân Tạo',
//     abbreviation: 'TT',
//     address: '14 đường số 2, phường Tân Tạo, quận Bình Tân, Tp. Hồ Chí Minh',
//     email: 'soli.tantao@gmail.com',
//     phone: '0333 717 560',
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
//   {
//     name: 'Soli 14 Nguyễn Văn Luông',
//     abbreviation: 'NVL',
//     address: '109/24 Nguyễn Văn Luông, phường 10, quận 6, Tp. Hồ Chí Minh',
//     email: 'soli.nvl@gmail.com',
//     phone: '0333 250 017',
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
// ];

// const initialEmployees = [
//   {
//     name: 'Tracy Bell',
//     phone: '0901 234 567',
//     avatar: null,
//     email: 'nguyenvana@example.com',
//     address: '14 đường số 2, phường Tân Tạo, quận Bình Tân, Tp. Hồ Chí Minh',
//     isActive: true,
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
//   {
//     name: 'Mike Godfrey',
//     phone: '0902 345 678',
//     avatar: null,
//     email: 'tranthib@example.com',
//     address: '109/24 Nguyễn Văn Luông, phường 10, quận 6, Tp. Hồ Chí Minh',
//     isActive: true,
//     createdAt: new Date(2026, 6, 28),
//     createdBy: 1,
//     updatedAt: new Date(2026, 6, 28),
//     updatedBy: 1,
//   },
// ];

// async function main() {
//   const branches = [];
//   for (const branch of initialBranches) {
//     branches.push(await prisma.branch.create({ data: branch }));
//   }
//   for (const employee of initialEmployees) {
//     await prisma.employee.create({
//       data: {
//         ...employee,
//         // Remove the id property if your Employee model uses autoincrement
//         // id: employee.id, // Remove/comment this line if autoincrement
//         branches: {
//           connect: branches.map((branch) => ({ id: branch.id })),
//         },
//       },
//     });
//   }
// }

// main()
//   .then(() => console.log('Seeding done.'))
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   });
