import type {Request,Response,NextFunction} from 'express';
import type {User} from '@prisma/client';
declare module 'express-session'{interface SessionData{userId?:string;slackState?:string}}
export type AuthedRequest=Request&{user:User};
export function requireAuth(req:Request,res:Response,next:NextFunction){if(!req.session.userId){res.status(401).json({error:'Authentication required'});return}next()}
