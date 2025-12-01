const { getPrismaClient } = require('./dist/config/database');
const prisma = getPrismaClient();

async function deleteUser() {
  try {
    const phoneNumber = process.argv[2];

    if (!phoneNumber) {
      console.log('❌ Please provide phone number');
      console.log('Usage: node delete-user.js 919876543210');
      process.exit(1);
    }

    console.log(`Looking for user with phone: ${phoneNumber}`);

    const user = await prisma.user.findUnique({
      where: { phoneNumber }
    });

    if (!user) {
      console.log('✅ No user found - you can start fresh!');
      process.exit(0);
    }

    console.log('User found:');
    console.log('- ID:', user.id);
    console.log('- Name:', user.name);
    console.log('- Onboarding Complete:', user.onboardingComplete);
    console.log('\nDeleting all user data...');

    const result = await prisma.$transaction(async (tx) => {
      const convos = await tx.conversation.deleteMany({ where: { userId: user.id } });
      const reminders = await tx.reminder.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
      return { convos: convos.count, reminders: reminders.count };
    });

    console.log('\n✅ Deleted successfully!');
    console.log('- Conversations:', result.convos);
    console.log('- Reminders:', result.reminders);
    console.log('- User: 1');
    console.log('\nYou can now message Pin Me fresh!');

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

deleteUser();
