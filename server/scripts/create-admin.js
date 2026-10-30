import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadEnvironment } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { createModels, ensureIndexes } from '../src/models/index.js';
import { createRepository } from '../src/services/repository.js';
import { hashPassword } from '../src/utils/auth.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--username' && argv[i + 1]) args.username = argv[++i];
    else if (arg === '--password' && argv[i + 1]) args.password = argv[++i];
    else if (arg === '--name' && argv[i + 1]) args.name = argv[++i];
    else if (arg === '--force') args.force = true;
  }
  return args;
}

async function main() {
  const cliArgs = parseArgs(process.argv);
  let username = cliArgs.username;
  let password = cliArgs.password;
  let name = cliArgs.name || 'مدير المطعم';

  if (!username || !password) {
    const rl = readline.createInterface({ input, output });
    try {
      if (!username) {
        username = (await rl.question('اسم المستخدم: ')).trim();
      }
      if (!password) {
        password = (await rl.question('كلمة المرور: ')).trim();
      }
      if (!cliArgs.name) {
        const inputName = (await rl.question('الاسم (افتراضي: مدير المطعم): ')).trim();
        if (inputName) name = inputName;
      }
    } finally {
      rl.close();
    }
  }

  username = (username || '').trim().toLowerCase();
  password = (password || '').trim();

  if (!username || username.length < 3) {
    console.error('خطأ: اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.');
    process.exit(1);
  }

  if (!/^[a-z0-9_-]+$/.test(username)) {
    console.error('خطأ: اسم المستخدم يجب أن يحتوي فقط على أحرف إنجليزية وأرقام وعلامة _ أو -');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('خطأ: كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.');
    process.exit(1);
  }

  const config = loadEnvironment();
  const connection = await connectDatabase(config);
  try {
    const models = createModels(connection);
    await ensureIndexes(models);
    const repository = createRepository(models);

    const existing = await repository.findAdminByUsername(username);
    const passwordHash = await hashPassword(password);

    if (existing) {
      if (cliArgs.force) {
        await repository.updateAdminPassword(username, passwordHash);
        console.log(`تم تحديث كلمة مرور المشرف «${username}» بنجاح.`);
      } else {
        console.log(`المستخدم «${username}» موجود مسبقًا. استخدم --force لتحديث كلمة المرور.`);
      }
    } else {
      await repository.createAdmin({
        username,
        passwordHash,
        name,
        role: 'owner',
      });
      console.log(`تم إنشاء حساب المشرف «${username}» بنجاح.`);
    }
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('فشل في إعداد حساب المشرف:', error.message);
  process.exit(1);
});
