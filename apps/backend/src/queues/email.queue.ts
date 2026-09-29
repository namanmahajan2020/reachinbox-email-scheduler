import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { stableEmailJobId } from '../services/scheduling.js';
export const connection=new Redis(env.REDIS_URL,{maxRetriesPerRequest:null});
export const emailQueue=new Queue('emails',{connection,defaultJobOptions:{attempts:4,backoff:{type:'exponential',delay:3000},removeOnComplete:1000,removeOnFail:5000}});
export const enqueueEmail=async(emailId:string,scheduledAt:Date)=>emailQueue.add('send-email',{emailId},{jobId:stableEmailJobId(emailId),delay:Math.max(0,scheduledAt.getTime()-Date.now())});
