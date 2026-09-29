import { prisma } from '../db/prisma.js';
import { enqueueEmail } from './email.queue.js';

/** Replays only unacknowledged PostgreSQL outbox rows; BullMQ job IDs make retries idempotent. */
export async function enqueuePendingEmails():Promise<{enqueued:number;pending:number}>{
  let enqueued=0;
  const rows=await prisma.queueOutbox.findMany({where:{enqueuedAt:null},include:{email:{select:{id:true,status:true,scheduledAt:true}}},orderBy:{createdAt:'asc'},take:10000});
  for(let offset=0;offset<rows.length;offset+=100){
    await Promise.all(rows.slice(offset,offset+100).map(async row=>{
      try{
        if(row.email.status==='scheduled'||row.email.status==='processing')await enqueueEmail(row.email.id,row.email.scheduledAt);
        await prisma.queueOutbox.update({where:{id:row.id},data:{enqueuedAt:new Date()}});
        enqueued++;
      }catch(error){
        console.error('Queue outbox dispatch failed; row will be retried on API restart',{outboxId:row.id,error:error instanceof Error?error.message:'unknown'});
      }
    }));
  }
  const remaining=await prisma.queueOutbox.count({where:{enqueuedAt:null}});
  return {enqueued,pending:remaining};
}
