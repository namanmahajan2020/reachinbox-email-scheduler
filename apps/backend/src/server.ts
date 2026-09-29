import {app} from './app.js';import {env} from './config/env.js';import {prisma} from './db/prisma.js';import {connection} from './queues/email.queue.js';import {enqueuePendingEmails} from './queues/outbox.js';
const dispatch=await enqueuePendingEmails();if(dispatch.pending)console.error('Queue outbox still has pending jobs',{pending:dispatch.pending});
const server=app.listen(env.PORT,()=>console.log(`API listening on ${env.PORT}`));
async function shutdown(){server.close();await prisma.$disconnect();await connection.quit();process.exit(0)}process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
