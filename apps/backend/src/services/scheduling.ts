export function uniqueRecipients(recipients:string[]):string[]{
  const unique=new Map<string,string>();
  for(const raw of recipients){const value=raw.trim(),key=value.toLowerCase();if(!unique.has(key))unique.set(key,value)}
  return [...unique.values()];
}

export function stableEmailJobId(emailId:string):string{return `email-${emailId}`;}

export function emailIdempotencyKey(campaignId:string,index:number,recipient:string,requestKey?:string):string{
  const normalized=recipient.trim().toLowerCase();
  return requestKey?`${requestKey}:${normalized}`:`${campaignId}:${index}:${normalized}`;
}
