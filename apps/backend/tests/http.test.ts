import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {app} from '../src/app.js';

describe('Express HTTP surface',()=>{
  it('serves health without opening a database session',async()=>{
    const response=await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({status:'ok'});
  });

  it('rejects protected APIs without an authenticated session',async()=>{
    const response=await request(app).get('/api/me');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('protects the live queue dashboard without an authenticated session',async()=>{
    const response=await request(app).get('/admin/queues');
    expect(response.status).toBe(401);
  });
});
